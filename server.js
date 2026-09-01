// NoFluxo — servidor Node.js com PostgreSQL + IA Gemini/Groq
const http = require('http');
const fs = require('fs');
const path = require('path');

// === PostgreSQL ===
// Variável de ambiente DATABASE_URL no Railway: postgres://user:pass@host:port/dbname
let pg = null;
let pgPool = null;
try {
  pg = require('pg');
} catch (e) {
  console.log('pg module not installed — sync entre dispositivos desativado');
}

const DATABASE_URL = process.env.DATABASE_URL || '';
const SYNC_ENABLED = !!(pg && DATABASE_URL);

if (SYNC_ENABLED) {
  pgPool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  // Cria tabelas SEQUENCIALMENTE (evita erro de FK)
  (async () => {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_users (
          email VARCHAR(255) PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE,
          google_name VARCHAR(255),
          google_picture TEXT,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          client_updated_at BIGINT NOT NULL DEFAULT 0,
          server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('✓ Tabela nofluxo_users pronta');

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_planilhas (
          id VARCHAR(64) PRIMARY KEY,
          owner_email VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('✓ Tabela nofluxo_planilhas pronta');

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_shares (
          planilha_id VARCHAR(64) NOT NULL REFERENCES nofluxo_planilhas(id) ON DELETE CASCADE,
          shared_with_email VARCHAR(255) NOT NULL,
          permission VARCHAR(20) NOT NULL DEFAULT 'editor',
          shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (planilha_id, shared_with_email)
        )
      `);
      console.log('✓ Tabela nofluxo_shares pronta');

      // Notificações in-app (também usado como fallback se email não configurado)
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_notifications (
          id SERIAL PRIMARY KEY,
          user_email VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          planilha_id VARCHAR(64),
          read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('✓ Tabela nofluxo_notifications pronta');

      // Presença de usuários (quem está online em cada planilha)
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_presence (
          planilha_id VARCHAR(64) NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          user_name VARCHAR(255),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (planilha_id, user_email)
        )
      `);
      console.log('✓ Tabela nofluxo_presence pronta');

      // Histórico de versões das planilhas
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS nofluxo_planilha_versions (
          id SERIAL PRIMARY KEY,
          planilha_id VARCHAR(64) NOT NULL REFERENCES nofluxo_planilhas(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          saved_by_email VARCHAR(255) NOT NULL,
          saved_by_name VARCHAR(255),
          saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          size_bytes BIGINT NOT NULL DEFAULT 0
        )
      `);
      console.log('✓ Tabela nofluxo_planilha_versions pronta');

      // Índices para performance
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_shares_user ON nofluxo_shares(shared_with_email)`);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_planilhas_owner ON nofluxo_planilhas(owner_email)`);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON nofluxo_notifications(user_email, read)`);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON nofluxo_notifications(created_at DESC)`);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_presence_planilha ON nofluxo_presence(planilha_id, last_seen_at)`);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_versions_planilha ON nofluxo_planilha_versions(planilha_id, saved_at DESC)`);
      console.log('✓ Todos os índices criados');
    } catch (e) {
      console.error('Erro ao criar tabelas:', e.message);
    }
  })();
}

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'nofluxo.html');

// === Resend (envio de email) — opcional ===
// Para habilitar notificações por email:
// 1. Crie conta em https://resend.com (gratuito até 100 emails/dia)
// 2. Crie uma API key e copie (re_...)
// 3. Verifique um domínio próprio em https://resend.com/domains (ou use onboarding@resend.dev para testes)
// 4. No Railway, adicione as variáveis:
//    RESEND_API_KEY=re_xxx
//    RESEND_FROM_EMAIL=nofluxo@seudominio.com (ou onboarding@resend.dev)
// 5. Pronto! Emails são enviados quando compartilha planilha, etc.
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
const APP_URL = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : (process.env.APP_URL || 'http://localhost:'+PORT);

// Envia email via Resend (sem dependências externas — usa fetch)
async function sendEmail(to, subject, htmlBody) {
  if (!RESEND_API_KEY) return { skipped: true, reason: 'RESEND_API_KEY não configurado' };
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'NoFluxo <' + RESEND_FROM_EMAIL + '>',
        to: to,
        subject: subject,
        html: htmlBody
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Resend erro:', resp.status, errText);
      return { error: errText };
    }
    return { ok: true };
  } catch (e) {
    console.error('sendEmail error:', e.message);
    return { error: e.message };
  }
}

// Cria notificação in-app + envia email (se configurado)
async function notifyUser(userEmail, type, title, message, planilhaId, planilhaName, shareOwnerEmail) {
  if (!SYNC_ENABLED) return;
  const email = (userEmail || '').toLowerCase().trim();
  if (!email) return;
  // 1) Cria notificação in-app (sempre)
  try {
    await pgPool.query(`
      INSERT INTO nofluxo_notifications (user_email, type, title, message, planilha_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [email, type, title, message || null, planilhaId || null]);
  } catch (e) { console.error('notifyUser insert error:', e.message); }

  // 2) Envia email (se configurado)
  if (RESEND_API_KEY) {
    const planilhaNome = planilhaName || 'planilha';
    const donoEmail = shareOwnerEmail || '';
    let subject, html;
    if (type === 'share_invited') {
      subject = `${donoEmail} compartilhou "${planilhaNome}" com você no NoFluxo`;
      html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;background:#F5F7FA;padding:24px 16px;border-radius:12px">
          <div style="text-align:center;margin-bottom:20px">
            <div style="display:inline-block;width:44px;height:44px;border-radius:11px;background:#003A49;display:grid;place-items:center;color:#fff;font-weight:800;font-size:18px">N</div>
          </div>
          <h1 style="font-size:18px;color:#003A49;text-align:center;margin:0 0 12px">${escapeHtml(donoEmail)} compartilhou uma planilha com você</h1>
          <div style="background:#fff;border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="font-size:13px;color:#5A6B72;margin-bottom:4px">Planilha:</div>
            <div style="font-size:16px;font-weight:700;color:#0F1B20">${escapeHtml(planilhaNome)}</div>
          </div>
          <p style="font-size:14px;color:#5A6B72;line-height:1.5">Você agora tem acesso a esta planilha no NoFluxo. Faça login com o email <b>${escapeHtml(email)}</b> para ver e editar junto com ${escapeHtml(donoEmail)}.</p>
          <div style="text-align:center;margin-top:24px">
            <a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#E67D00;color:#fff;border-radius:99px;font-weight:700;text-decoration:none;font-size:14px">Abrir NoFluxo</a>
          </div>
          <p style="font-size:11px;color:#94A3A8;text-align:center;margin-top:24px">Se você não esperava este convite, pode ignorar este email.</p>
        </div>
      `;
    } else {
      subject = title;
      html = `<div style="font-family:Inter,Arial,sans-serif;padding:24px"><h2 style="color:#003A49">${escapeHtml(title)}</h2><p style="color:#5A6B72">${escapeHtml(message||'')}</p></div>`;
    }
    await sendEmail(email, subject, html);
  }
}

// Helper simples de escape para HTML dos emails
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Chave do Google Gemini — criar em https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
// Lista de modelos Gemini (atualizada 2025). Tentados em ordem até um funcionar.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];
let GEMINI_MODEL_PREF = (process.env.GEMINI_MODEL || '').trim();

// Chave do Groq — criar em https://console.groq.com/keys
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
// Lista de modelos Groq (atualizada 09/2026). Tentados em ordem.
// NOTA: llama-3.3-70b-versatile, llama-3.1-8b-instant e gemma2-9b-it foram descontinuados
// pela Groq (ago/2026) — a recomendação oficial da Groq é migrar para a família gpt-oss.
// qwen/qwen3.6-27b também está sendo descontinuado (decommission em 14/09/2026) em favor
// de qwen/qwen3.8-27b, então já usamos direto a versão nova para não depender do redirect
// automático da Groq. Se a Groq aposentar algum destes de novo, o fallback dinâmico logo
// abaixo (fetchGroqModels) busca outros modelos disponíveis automaticamente.
const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

const PREFERRED_PROVIDER = (process.env.LLM_PROVIDER || 'groq').toLowerCase().trim();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 5e6) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// Monta o prompt para o Gemini com o contexto do app
function buildSystemPrompt(context) {
  const fmt = (v) => 'R$ ' + (Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let txt = 'Você é o Agente NoFluxo, assistente financeiro do usuário dentro do app NoFluxo. Responda sempre em português brasileiro, de forma amigável, direta e prática.\n\n';
  txt += 'Use sempre que possível os dados financeiros do usuário abaixo para dar respostas personalizadas e calculadas:\n\n';
  if (context && context.mes) {
    txt += '== DADOS DO USUÁRIO ==\n';
    txt += `Mês atual: ${context.mes}\n`;
    txt += `Saldo acumulado (até o mês anterior): ${fmt(context.saldoAcumulado)}\n`;
    if (context.mesAtual) {
      txt += `\n-- Mês ${context.mes} --\n`;
      txt += `Receitas (total): ${fmt(context.mesAtual.receitas)}\n`;
      txt += `Despesas (total): ${fmt(context.mesAtual.despesas)}\n`;
      txt += `Reservas (aportes): ${fmt(context.mesAtual.reservas)}\n`;
      txt += `A receber (pendentes): ${fmt(context.mesAtual.aReceber)}\n`;
      txt += `A pagar (pendentes): ${fmt(context.mesAtual.aPagar)}\n`;
      const saldoMes = context.mesAtual.receitas - context.mesAtual.despesas;
      txt += `Saldo do mês: ${fmt(saldoMes)}\n`;
    }
    if (context.dividasRecorrentes && context.dividasRecorrentes.length) {
      txt += '\n-- DÍVIDAS PARCELADAS (recorrentes) --\n';
      context.dividasRecorrentes.forEach((d, i) => {
        const restantes = d.parcelaTotal - d.parcelaAtual + 1;
        txt += `${i + 1}. ${d.nome}: ${d.moeda === 'BRL' ? 'R$' : d.moeda + ' '}${d.valor} por mês, parcela ${d.parcelaAtual}/${d.parcelaTotal} (restam ${restantes}), desde ${d.dataInicio}`;
        if (d.jurosMensal > 0) txt += `, juros ${d.jurosMensal}% ${d.frequencia === 'yearly' ? 'ao ano' : 'ao mês'}`;
        txt += '\n';
      });
      txt += '\nPara calcular em que mês uma dívida termina: some (parcelaAtual + parcelas restantes) ao mês de início. Ex: se começou em 2026-03 e está na parcela 2/10, faltam 9 parcelas, então termina em 2026-12.\n';
    }
    if (context.metasSubgrupos && context.metasSubgrupos.length) {
      txt += '\n-- METAS DE SUBGRUPOS --\n';
      context.metasSubgrupos.forEach(m => {
        txt += `${m.subgrupo}: meta ${m.moeda === 'BRL' ? 'R$' : m.moeda + ' '}${m.meta}\n`;
      });
    }
    if (context.itensPendentes && context.itensPendentes.length) {
      txt += '\n-- ITENS PENDENTES (a receber / a pagar) --\n';
      context.itensPendentes.forEach(p => {
        txt += `${p.tipo.toUpperCase()}: ${p.nome} — ${p.moeda === 'BRL' ? 'R$' : p.moeda + ' '}${p.valor} (data ${p.data})\n`;
      });
    }
    txt += '== FIM DOS DADOS ==\n\n';
  }
  txt += 'INSTRUÇÕES:\n';
  txt += '- Nunca mostre seu processo de raciocínio, pensamento passo-a-passo, ou cadeia de pensamento. Responda DIRETAMENTE com a resposta final.\n';
  txt += '- Não inclua frases como "Vamos pensar sobre isso", "Aqui está o processo", "Passo 1", etc.\n';
  txt += '- Quando o usuário perguntar "em que mês minha dívida termina", calcule o mês exato a partir dos dados das dívidas recorrentes.\n';
  txt += '- Quando perguntar sobre saldo, reserve, metas — use os valores reais do usuário.\n';
  txt += '- Se precisar de informações externas (taxas, conceitos financeiros, notícias), use a busca do Google (já está habilitada automaticamente).\n';
  txt += '- Seja breve: máximo 4-5 parágrafos curtos. Use bullet points quando apropriado.\n';
  txt += '- Nunca invente números. Se não souber, diga que precisa de mais dados.\n';
  return txt;
}

// Pós-processamento: remove qualquer "raciocínio" visível na resposta (caso o modelo
// ainda mostre pensamento mesmo com a instrução no prompt)
function cleanReasoning(text) {
  if (!text) return text;
  // Remove blocos <think>...</think> (usados por alguns modelos de raciocínio)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Remove blocos  que alguns modelos de raciocínio adicionam
  text = text.replace(/【\d+:\d+†source】/g, '').trim();
  // Remove prefixos comuns de "thinking" que DeepSeek e similares usam
  const thinkingPatterns = [
    /^Here['']?s a thinking process[\s\S]*?(?=\n(?:A |O |Para|Reserv|E |Bom|Olá))/im,
    /^Let['']?s think about[\s\S]*?(?=\n(?:A |O |Para|Reserv|E |Bom|Olá))/im,
    /^Thinking process[\s\S]*?(?=\n(?:A |O |Para|Reserv|E |Bom|Olá))/im,
    /^Analisando[\s\S]*?(?=\n(?:A |O |Para|Reserv|E |Bom|Olá))/im,
  ];
  for (const p of thinkingPatterns) {
    if (p.test(text)) {
      const match = text.match(p);
      if (match) {
        text = text.slice(match[0].length).trim();
      }
    }
  }
  return text;
}
async function fetchGroqModels() {
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const models = (data.data || []).map(m => m.id).filter(id =>
      /llama|gemma|deepseek|qwen|gpt-oss/i.test(id) && !/whisper|guard|mixtral/i.test(id)
    );
    console.log('Modelos Groq disponíveis dinamicamente:', models.join(', '));
    return models;
  } catch (e) {
    console.log('Não foi possível buscar lista dinâmica de modelos Groq:', e.message);
    return [];
  }
}

// Busca lista de modelos disponíveis no Gemini
async function fetchGeminiModels() {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const models = (data.models || [])
      .map(m => m.name.replace('models/', ''))
      .filter(id => /flash/i.test(id) && /generateContent/.test((m = (data.models.find(x => x.name.replace('models/','') === id) || {})).supportedGenerationMethods?.join(',') || ''));
    console.log('Modelos Gemini disponíveis dinamicamente:', models.join(', '));
    return models;
  } catch (e) {
    console.log('Não foi possível buscar lista dinâmica de modelos Gemini:', e.message);
    return [];
  }
}

// Chama o Groq — tenta a lista estática e, se todos falharem, busca dinamicamente
async function callGroq(userMessage, context, history) {
  if (!GROQ_API_KEY) return { error: 'GROQ_API_KEY não configurada' };
  const systemPrompt = buildSystemPrompt(context);
  const messages = [{ role: 'system', content: systemPrompt }];
  if (history && Array.isArray(history)) {
    history.forEach(h => {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
    });
  }
  messages.push({ role: 'user', content: userMessage });

  // Primeiro tenta a lista estática, depois busca dinâmica
  const allErrors = [];
  for (const pass of [1, 2]) {
    let modelsToTry;
    if (pass === 1) {
      modelsToTry = GROQ_MODELS;
    } else {
      // Passada 2: busca dinâmica
      const dynamic = await fetchGroqModels();
      // Remove duplicatas dos que já tentamos
      modelsToTry = dynamic.filter(m => !GROQ_MODELS.includes(m));
      if (!modelsToTry.length) break;
    }
    for (const model of modelsToTry) {
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1500,
          })
        });
        if (resp.status === 401) {
          const e = await resp.text();
          let msg = e;
          try { const j = JSON.parse(e); msg = j.error?.message || e; } catch (_) {}
          return { error: `Groq API key inválida (401): ${msg}` };
        }
        if (!resp.ok) {
          const errText = await resp.text();
          let errMsg = `HTTP ${resp.status}`;
          try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch (_) {}
          allErrors.push(`${model}: ${errMsg}`);
          if (resp.status === 429) {
            // Rate limit no Groq — para tudo e retorna erro (não adianta tentar outro modelo)
            return { error: `Groq rate-limitado (429). Aguarde 1 minuto. Detalhes: ${errMsg}` };
          }
          continue;
        }
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (!text) { allErrors.push(`${model}: resposta vazia`); continue; }
        console.log(`Agente respondeu usando Groq ${model}`);
        return { response: cleanReasoning(text) };
      } catch (err) {
        allErrors.push(`${model}: ${err.message}`);
        continue;
      }
    }
  }
  return { error: `Todos os modelos Groq falharam:\n${allErrors.join('\n')}` };
}

// Chama o Gemini — tenta a lista estática e, se todos falharem, busca dinâmica
async function callGemini(userMessage, context, history) {
  if (!GEMINI_API_KEY) return { error: 'GEMINI_API_KEY não configurada' };
  const systemPrompt = buildSystemPrompt(context);
  const contents = [];
  if (history && Array.isArray(history)) {
    history.forEach(h => {
      contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
  };
  const modelsToTryStatic = GEMINI_MODEL_PREF ? [GEMINI_MODEL_PREF, ...GEMINI_MODELS.filter(m => m !== GEMINI_MODEL_PREF)] : GEMINI_MODELS;
  const allErrors = [];
  for (const pass of [1, 2]) {
    let modelsToTry;
    if (pass === 1) {
      modelsToTry = modelsToTryStatic;
    } else {
      const dynamic = await fetchGeminiModels();
      modelsToTry = dynamic.filter(m => !modelsToTryStatic.includes(m));
      if (!modelsToTry.length) break;
    }
    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      try {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (resp.status === 401 || resp.status === 403) {
          const errText = await resp.text();
          let msg = errText;
          try { const j = JSON.parse(errText); msg = j.error?.message || errText; } catch (_) {}
          return { error: `Gemini API key inválida ou API não habilitada (HTTP ${resp.status}): ${msg}. Verifique se a API "Generative Language API" está habilitada em https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com` };
        }
        if (!resp.ok) {
          const errText = await resp.text();
          let errMsg = `HTTP ${resp.status}`;
          try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch (_) {}
          allErrors.push(`${model}: ${errMsg}`);
          if (resp.status === 429) {
            return { error: `Gemini rate-limitado (429): ${errMsg}` };
          }
          continue;
        }
        const data = await resp.json();
        const candidates = data.candidates || [];
        if (!candidates.length) { allErrors.push(`${model}: sem candidatos`); continue; }
        const parts = candidates[0].content?.parts || [];
        let text = parts.filter(p => p.text).map(p => p.text).join('\n');
        const grounding = candidates[0].groundingMetadata;
        if (grounding && grounding.webSearchQueries && grounding.webSearchQueries.length) {
          text += '\n\n_(resposta com base em busca web em tempo real)_';
        }
        console.log(`Agente respondeu usando Gemini ${model}`);
        return { response: cleanReasoning(text) || 'Não consegui gerar uma resposta. Tente reformular.' };
      } catch (err) {
        allErrors.push(`${model}: ${err.message}`);
        continue;
      }
    }
  }
  return { error: `Todos os modelos Gemini falharam:\n${allErrors.join('\n')}` };
}

// Dispatcher principal — tenta provedores em ordem de preferência, COLETANDO TODOS OS ERROS
async function callLLM(userMessage, context, history) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    return { error: 'Nenhuma chave de API configurada. Adicione GROQ_API_KEY (https://console.groq.com/keys) ou GEMINI_API_KEY (https://aistudio.google.com/app/apikey) nas variáveis de ambiente do Railway.' };
  }
  const providers = [];
  if (PREFERRED_PROVIDER === 'groq') {
    if (GROQ_API_KEY) providers.push({ name: 'Groq', fn: callGroq });
    if (GEMINI_API_KEY) providers.push({ name: 'Gemini', fn: callGemini });
  } else {
    if (GEMINI_API_KEY) providers.push({ name: 'Gemini', fn: callGemini });
    if (GROQ_API_KEY) providers.push({ name: 'Groq', fn: callGroq });
  }
  const allErrors = [];
  for (const p of providers) {
    console.log(`Tentando provedor: ${p.name}...`);
    const result = await p.fn(userMessage, context, history);
    if (result && result.response) return result;
    const errMsg = result?.error || 'erro desconhecido';
    allErrors.push(`${p.name}: ${errMsg}`);
    console.log(`Provedor ${p.name} falhou: ${errMsg}`);
  }
  return { error: 'Todos os provedores falharam. Detalhes:\n' + allErrors.join('\n') };
}

// === Rate limiting simples em memória (por IP) ===
// Mitiga (1) abuso de custo no /api/agent — cada chamada aciona a Groq/Gemini, que são
// pagas, e o endpoint não tem autenticação — e (2) tentativas de força-bruta de
// email/ID nos outros endpoints /api/*. NÃO substitui autenticação de verdade — é só
// uma camada a mais enquanto isso não existe (ver observações de segurança no final).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimitBuckets = new Map(); // "categoria:ip" -> { count, windowStart }
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return xf.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}
function isRateLimited(req, maxPerMinute, category) {
  const key = category + ':' + getClientIp(req);
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count > maxPerMinute;
}
// Limpa buckets antigos periodicamente pra não vazar memória
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of rateLimitBuckets) {
    if (now - b.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  let urlPath = req.url.split('?')[0];

  // CORS restrito à própria origem do app — antes era '*', o que permitia que QUALQUER
  // site na internet lesse as respostas dessas APIs via fetch() rodando no navegador de
  // quem visitasse ele (bastava saber o email de alguém). Agora só o próprio domínio do
  // app (e localhost em desenvolvimento) recebem o header, então navegadores bloqueiam
  // a leitura cross-origin para qualquer outro site.
  const ALLOWED_ORIGINS = [APP_URL, `http://localhost:${PORT}`, 'http://localhost:3000'];
  const reqOrigin = req.headers.origin;
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Rate limit por IP nas rotas /api/* — limite mais apertado no agente de IA (custa
  // dinheiro por chamada), mais folgado nas demais (só pra dificultar varredura em massa)
  if (urlPath.startsWith('/api/')) {
    const isAgent = urlPath === '/api/agent';
    if (isRateLimited(req, isAgent ? 12 : 100, isAgent ? 'agent' : 'general')) {
      return sendJSON(res, 429, { error: 'Muitas requisições deste IP. Aguarde um minuto e tente de novo.' });
    }
  }

  // === API do Agente IA ===
  if (urlPath === '/api/agent' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { message, context, history } = body;
      if (!message || typeof message !== 'string') {
        return sendJSON(res, 400, { error: 'Mensagem ausente' });
      }
      const result = await callLLM(message, context || {}, history || []);
      return sendJSON(res, 200, result);
    } catch (err) {
      console.error('Agent error:', err);
      return sendJSON(res, 500, { error: 'Erro interno: ' + err.message });
    }
  }

  // === API de sincronização (Postgres) — POST sobe, GET baixa ===
  if (urlPath === '/api/sync' && req.method === 'POST') {
    if (!SYNC_ENABLED) {
      return sendJSON(res, 503, { error: 'Sync não configurado. Defina DATABASE_URL no Railway.' });
    }
    try {
      const body = await readBody(req);
      const { email, googleId, googleName, googlePicture, data, clientUpdatedAt } = body;
      if (!email || typeof email !== 'string') {
        return sendJSON(res, 400, { error: 'Email é obrigatório' });
      }
      const clientTs = Number(clientUpdatedAt) || Date.now();
      // Busca versão atual do servidor
      const sel = await pgPool.query('SELECT data, client_updated_at FROM nofluxo_users WHERE email=$1', [email]);
      const serverRow = sel.rows[0];
      const serverClientTs = serverRow ? Number(serverRow.client_updated_at) : 0;

      let mergedData = data;
      let shouldReturnServer = false;

      if (serverRow && serverClientTs > clientTs) {
        // Servidor tem versão mais recente — retorna ela, não sobrescreve
        mergedData = serverRow.data;
        shouldReturnServer = true;
      } else {
        // Cliente tem versão mais recente (ou é novo) — sobrescreve servidor
        // Tira o passHash do objeto data por segurança (não sincroniza senhas locais)
        let dataToStore = data;
        if (dataToStore && typeof dataToStore === 'object' && 'passHash' in dataToStore) {
          dataToStore = { ...dataToStore, passHash: undefined };
        }
        // UPSERT
        await pgPool.query(`
          INSERT INTO nofluxo_users (email, google_id, google_name, google_picture, data, client_updated_at, server_updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (email) DO UPDATE SET
            google_id = COALESCE(EXCLUDED.google_id, nofluxo_users.google_id),
            google_name = COALESCE(EXCLUDED.google_name, nofluxo_users.google_name),
            google_picture = COALESCE(EXCLUDED.google_picture, nofluxo_users.google_picture),
            data = EXCLUDED.data,
            client_updated_at = EXCLUDED.client_updated_at,
            server_updated_at = NOW()
        `, [email.toLowerCase(), googleId || null, googleName || null, googlePicture || null, JSON.stringify(dataToStore || {}), clientTs]);
      }

      return sendJSON(res, 200, {
        ok: true,
        serverHasNewer: shouldReturnServer,
        data: mergedData,
        serverUpdatedAt: serverRow ? serverRow.server_updated_at : new Date().toISOString(),
      });
    } catch (err) {
      console.error('Sync POST error:', err);
      return sendJSON(res, 500, { error: 'Erro no sync: ' + err.message });
    }
  }

  if (urlPath === '/api/sync' && req.method === 'GET') {
    if (!SYNC_ENABLED) {
      return sendJSON(res, 503, { error: 'Sync não configurado' });
    }
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) {
        return sendJSON(res, 400, { error: 'Email é obrigatório (query param email)' });
      }
      const sel = await pgPool.query('SELECT data, client_updated_at, server_updated_at, google_name, google_picture FROM nofluxo_users WHERE email=$1', [email]);
      if (!sel.rows.length) {
        return sendJSON(res, 200, { ok: true, exists: false, data: null });
      }
      const row = sel.rows[0];
      return sendJSON(res, 200, {
        ok: true,
        exists: true,
        data: row.data,
        clientUpdatedAt: Number(row.client_updated_at),
        serverUpdatedAt: row.server_updated_at,
        googleName: row.google_name,
        googlePicture: row.google_picture,
      });
    } catch (err) {
      console.error('Sync GET error:', err);
      return sendJSON(res, 500, { error: 'Erro no sync: ' + err.message });
    }
  }

  // === API de planilhas (entidade separada para compartilhamento) ===

  // Lista todas as planilhas que o usuário tem acesso (próprias + compartilhadas)
  if (urlPath === '/api/planilhas' && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });

      // Planilhas próprias
      const ownQ = await pgPool.query(
        'SELECT id, name, owner_email, updated_at, created_at FROM nofluxo_planilhas WHERE owner_email=$1 ORDER BY created_at DESC',
        [email]
      );
      // Planilhas compartilhadas comigo
      const sharedQ = await pgPool.query(
        `SELECT p.id, p.name, p.owner_email, p.updated_at, p.created_at, s.permission
         FROM nofluxo_planilhas p
         JOIN nofluxo_shares s ON s.planilha_id = p.id
         WHERE s.shared_with_email = $1
         ORDER BY s.shared_at DESC`,
        [email]
      );
      const result = [
        ...ownQ.rows.map(r => ({ id: r.id, name: r.name, ownerEmail: r.owner_email, updatedAt: Number(r.updated_at), createdAt: r.created_at, role: 'owner' })),
        ...sharedQ.rows.map(r => ({ id: r.id, name: r.name, ownerEmail: r.owner_email, updatedAt: Number(r.updated_at), createdAt: r.created_at, role: r.permission }))
      ];
      return sendJSON(res, 200, { ok: true, planilhas: result });
    } catch (err) {
      console.error('List planilhas error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Migra planilhas do user.data para a tabela separada (chamado uma vez na primeira vez)
  if (urlPath === '/api/migrate-planilhas' && req.method === 'POST') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const body = await readBody(req);
      const { email, planilhas } = body;
      if (!email || !Array.isArray(planilhas)) return sendJSON(res, 400, { error: 'email e planilhas[] obrigatórios' });
      const migrated = [];
      for (const p of planilhas) {
        if (!p.id) continue;
        // Tenta inserir — se já existe (mesmo ID), não sobrescreve
        try {
          await pgPool.query(`
            INSERT INTO nofluxo_planilhas (id, owner_email, name, data, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `, [p.id, email.toLowerCase(), p.name || 'Minha planilha', JSON.stringify(p), Number(p._updatedAt) || Date.now()]);
          migrated.push(p.id);
        } catch (e) { console.error('Migrate planilha erro:', e.message); }
      }
      return sendJSON(res, 200, { ok: true, migrated: migrated.length, ids: migrated });
    } catch (err) {
      console.error('Migrate error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Pegar planilha completa por ID
  if (urlPath.startsWith('/api/planilha/') && req.method === 'GET' && !urlPath.includes('/share')) {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const id = urlPath.replace('/api/planilha/', '');
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });

      // Verifica acesso: dono OU compartilhada
      const q = await pgPool.query(`
        SELECT p.*, s.permission AS role
        FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1 AND (p.owner_email = $2 OR s.shared_with_email IS NOT NULL)
      `, [id, email]);
      if (!q.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada ou sem acesso' });

      const row = q.rows[0];
      const role = row.role || 'owner';
      return sendJSON(res, 200, {
        ok: true,
        planilha: row.data,
        id: row.id,
        name: row.name,
        ownerEmail: row.owner_email,
        role: role,
        updatedAt: Number(row.updated_at),
      });
    } catch (err) {
      console.error('Get planilha error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Salvar planilha (criar nova ou atualizar existente)
  if (urlPath.startsWith('/api/planilha/') && req.method === 'POST' && !urlPath.includes('/share')) {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const id = urlPath.replace('/api/planilha/', '');
      const body = await readBody(req);
      const { email, name, data, updatedAt, ownerEmail, create } = body;
      const requesterEmail = (email || '').toLowerCase().trim();
      if (!requesterEmail) return sendJSON(res, 400, { error: 'Email obrigatório' });

      const clientTs = Number(updatedAt) || Date.now();

      if (create) {
        // Criar nova planilha — usuário é o dono
        await pgPool.query(`
          INSERT INTO nofluxo_planilhas (id, owner_email, name, data, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        `, [id, requesterEmail, name || 'Minha planilha', JSON.stringify(data || {}), clientTs]);
        return sendJSON(res, 200, { ok: true, role: 'owner' });
      }

      // Atualizar planilha existente — verifica acesso
      const existing = await pgPool.query(`
        SELECT p.owner_email, s.permission
        FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1
      `, [id, requesterEmail]);
      if (!existing.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      const row = existing.rows[0];
      const isOwner = row.owner_email === requesterEmail;
      const role = row.permission || (isOwner ? 'owner' : null);
      if (!isOwner && role !== 'editor') {
        return sendJSON(res, 403, { error: 'Sem permissão de edição' });
      }
      // Verifica conflito — só atualiza se cliente for mais recente
      const cur = await pgPool.query('SELECT updated_at FROM nofluxo_planilhas WHERE id=$1', [id]);
      const serverTs = Number(cur.rows[0]?.updated_at) || 0;
      if (serverTs > clientTs) {
        // Servidor é mais recente — retorna versão do servidor
        const serverRow = await pgPool.query('SELECT data, name FROM nofluxo_planilhas WHERE id=$1', [id]);
        return sendJSON(res, 200, {
          ok: true,
          serverHasNewer: true,
          data: serverRow.rows[0]?.data,
          serverUpdatedAt: serverTs,
        });
      }
      // Atualiza
      await pgPool.query(`
        UPDATE nofluxo_planilhas SET name=$1, data=$2, updated_at=$3 WHERE id=$4
      `, [name || 'Minha planilha', JSON.stringify(data || {}), clientTs, id]);
      // Salva versão (auto-versionamento a cada save — limita a 50)
      const dataStr = JSON.stringify(data || {});
      await pgPool.query(`
        INSERT INTO nofluxo_planilha_versions (planilha_id, data, saved_by_email, saved_by_name, size_bytes)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, dataStr, requesterEmail, requesterEmail, dataStr.length]);
      // Limpa versões antigas (mantém só últimas 50)
      await pgPool.query(`
        DELETE FROM nofluxo_planilha_versions
        WHERE planilha_id=$1 AND id NOT IN (
          SELECT id FROM nofluxo_planilha_versions WHERE planilha_id=$1 ORDER BY saved_at DESC LIMIT 50
        )
      `, [id]);
      return sendJSON(res, 200, { ok: true, role: role || 'owner', updatedAt: clientTs });
    } catch (err) {
      console.error('Save planilha error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Excluir planilha (só dono)
  if (urlPath.startsWith('/api/planilha/') && req.method === 'DELETE' && !urlPath.includes('/share')) {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const id = urlPath.replace('/api/planilha/', '');
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });
      // Verifica se é dono
      const cur = await pgPool.query('SELECT owner_email FROM nofluxo_planilhas WHERE id=$1', [id]);
      if (!cur.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      if (cur.rows[0].owner_email !== email) return sendJSON(res, 403, { error: 'Só o dono pode excluir' });
      // Deleta (CASCADE remove as shares)
      await pgPool.query('DELETE FROM nofluxo_planilhas WHERE id=$1', [id]);
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('Delete planilha error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Compartilhar planilha com outro email
  if (urlPath.endsWith('/share') && req.method === 'POST') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const id = parts[parts.length - 2]; // /api/planilha/ID/share
      const body = await readBody(req);
      const { ownerEmail, shareWithEmail, permission } = body;
      const owner = (ownerEmail || '').toLowerCase().trim();
      const shareEmail = (shareWithEmail || '').toLowerCase().trim();
      if (!owner || !shareEmail) return sendJSON(res, 400, { error: 'ownerEmail e shareWithEmail obrigatórios' });
      if (owner === shareEmail) return sendJSON(res, 400, { error: 'Não dá pra compartilhar consigo mesmo' });

      // Verifica se é dono
      const cur = await pgPool.query('SELECT owner_email, name FROM nofluxo_planilhas WHERE id=$1', [id]);
      if (!cur.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      if (cur.rows[0].owner_email !== owner) return sendJSON(res, 403, { error: 'Só o dono pode compartilhar' });

      // Insere share (ou atualiza permissão se já existe)
      await pgPool.query(`
        INSERT INTO nofluxo_shares (planilha_id, shared_with_email, permission)
        VALUES ($1, $2, $3)
        ON CONFLICT (planilha_id, shared_with_email) DO UPDATE SET
          permission = EXCLUDED.permission,
          shared_at = NOW()
      `, [id, shareEmail, permission || 'editor']);
      // Notifica (in-app + email se configurado)
      await notifyUser(shareEmail, 'share_invited',
        'Nova planilha compartilhada com você',
        `${owner} compartilhou a planilha "${cur.rows[0].name}" com você.`,
        id, cur.rows[0].name, owner);
      return sendJSON(res, 200, { ok: true, planilhaName: cur.rows[0].name, notified: true });
    } catch (err) {
      console.error('Share error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Listar com quem a planilha foi compartilhada (só dono ou compartilhado)
  if (urlPath.endsWith('/share') && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const id = parts[parts.length - 2];
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });

      // Verifica acesso
      const cur = await pgPool.query('SELECT owner_email FROM nofluxo_planilhas WHERE id=$1', [id]);
      if (!cur.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      const isOwner = cur.rows[0].owner_email === email;
      if (!isOwner) {
        const share = await pgPool.query('SELECT 1 FROM nofluxo_shares WHERE planilha_id=$1 AND shared_with_email=$2', [id, email]);
        if (!share.rows.length) return sendJSON(res, 403, { error: 'Sem acesso' });
      }
      const shares = await pgPool.query('SELECT shared_with_email, permission, shared_at FROM nofluxo_shares WHERE planilha_id=$1 ORDER BY shared_at DESC', [id]);
      return sendJSON(res, 200, {
        ok: true,
        ownerEmail: cur.rows[0].owner_email,
        isOwner: isOwner,
        shares: shares.rows.map(r => ({ email: r.shared_with_email, permission: r.permission, sharedAt: r.shared_at }))
      });
    } catch (err) {
      console.error('List shares error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // Revogar compartilhamento (só dono)
  if (urlPath.endsWith('/share') && req.method === 'DELETE') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const id = parts[parts.length - 2];
      const params = new URL(req.url, 'http://localhost').searchParams;
      const ownerEmail = (params.get('ownerEmail') || '').toLowerCase().trim();
      const shareWithEmail = (params.get('shareWithEmail') || '').toLowerCase().trim();
      if (!ownerEmail || !shareWithEmail) return sendJSON(res, 400, { error: 'ownerEmail e shareWithEmail obrigatórios' });

      const cur = await pgPool.query('SELECT owner_email FROM nofluxo_planilhas WHERE id=$1', [id]);
      if (!cur.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      if (cur.rows[0].owner_email !== ownerEmail) return sendJSON(res, 403, { error: 'Só o dono pode revogar' });

      await pgPool.query('DELETE FROM nofluxo_shares WHERE planilha_id=$1 AND shared_with_email=$2', [id, shareWithEmail]);
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('Unshare error:', err);
      return sendJSON(res, 500, { error: 'Erro: ' + err.message });
    }
  }

  // === API de notificações (in-app) ===
  // Lista notificações do usuário
  if (urlPath === '/api/notifications' && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });
      const q = await pgPool.query(
        'SELECT id, type, title, message, planilha_id, read, created_at FROM nofluxo_notifications WHERE user_email=$1 ORDER BY created_at DESC LIMIT 50',
        [email]
      );
      const unreadQ = await pgPool.query('SELECT COUNT(*) AS c FROM nofluxo_notifications WHERE user_email=$1 AND read=FALSE', [email]);
      return sendJSON(res, 200, {
        ok: true,
        notifications: q.rows.map(r => ({ id: r.id, type: r.type, title: r.title, message: r.message, planilhaId: r.planilha_id, read: r.read, createdAt: r.created_at })),
        unread: Number(unreadQ.rows[0].c) || 0,
      });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // Marca todas como lidas
  if (urlPath === '/api/notifications/read-all' && req.method === 'POST') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const body = await readBody(req);
      const email = (body.email || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });
      await pgPool.query('UPDATE nofluxo_notifications SET read=TRUE WHERE user_email=$1', [email]);
      return sendJSON(res, 200, { ok: true });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // === API de presença (quem está online agora) ===
  if (urlPath === '/api/presence' && req.method === 'POST') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const body = await readBody(req);
      const { email, planilhaId, userName } = body;
      const e = (email || '').toLowerCase().trim();
      if (!e || !planilhaId) return sendJSON(res, 400, { error: 'email e planilhaId obrigatórios' });
      await pgPool.query(`
        INSERT INTO nofluxo_presence (planilha_id, user_email, user_name, last_seen_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (planilha_id, user_email) DO UPDATE SET
          user_name = EXCLUDED.user_name,
          last_seen_at = NOW()
      `, [planilhaId, e, userName || e]);
      // Limpa presenças antigas (> 30s sem atualização)
      await pgPool.query("DELETE FROM nofluxo_presence WHERE last_seen_at < NOW() - INTERVAL '30 seconds'");
      return sendJSON(res, 200, { ok: true });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // Lista quem está online em uma planilha
  if (urlPath.startsWith('/api/presence/') && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const planilhaId = urlPath.replace('/api/presence/', '');
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email || !planilhaId) return sendJSON(res, 400, { error: 'email e planilhaId obrigatórios' });
      // Verifica acesso
      const acc = await pgPool.query(`
        SELECT 1 FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1 AND (p.owner_email = $2 OR s.shared_with_email IS NOT NULL)
      `, [planilhaId, email]);
      if (!acc.rows.length) return sendJSON(res, 403, { error: 'Sem acesso' });
      // Lista quem esteve ativo nos últimos 30s
      const q = await pgPool.query(`
        SELECT user_email, user_name, last_seen_at,
          EXTRACT(EPOCH FROM (NOW() - last_seen_at)) AS secs_ago
        FROM nofluxo_presence
        WHERE planilha_id = $1 AND last_seen_at > NOW() - INTERVAL '30 seconds'
        ORDER BY last_seen_at DESC
      `, [planilhaId]);
      return sendJSON(res, 200, {
        ok: true,
        online: q.rows.map(r => ({
          email: r.user_email,
          name: r.user_name || r.user_email,
          isMe: r.user_email === email,
          secsAgo: Math.round(Number(r.secs_ago) || 0),
        })),
      });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // === API de histórico de versões ===
  // Lista versões (mais recentes primeiro)
  if (urlPath.includes('/versions') && urlPath.endsWith('/versions') && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const planilhaId = parts[parts.length - 2]; // /api/planilha/ID/versions
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email || !planilhaId) return sendJSON(res, 400, { error: 'email e planilhaId obrigatórios' });
      // Verifica acesso
      const acc = await pgPool.query(`
        SELECT 1 FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1 AND (p.owner_email = $2 OR s.shared_with_email IS NOT NULL)
      `, [planilhaId, email]);
      if (!acc.rows.length) return sendJSON(res, 403, { error: 'Sem acesso' });
      const q = await pgPool.query(`
        SELECT id, saved_by_email, saved_by_name, saved_at, size_bytes
        FROM nofluxo_planilha_versions
        WHERE planilha_id = $1
        ORDER BY saved_at DESC
        LIMIT 50
      `, [planilhaId]);
      return sendJSON(res, 200, {
        ok: true,
        versions: q.rows.map(r => ({ id: r.id, savedByEmail: r.saved_by_email, savedByName: r.saved_by_name, savedAt: r.saved_at, sizeBytes: Number(r.size_bytes) })),
      });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // Pega versão específica (para preview)
  if (urlPath.match(/\/versions\/\d+$/) && req.method === 'GET') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const versionId = parts[parts.length - 1];
      const planilhaId = parts[parts.length - 3];
      const params = new URL(req.url, 'http://localhost').searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });
      // Verifica acesso à planilha
      const acc = await pgPool.query(`
        SELECT 1 FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1 AND (p.owner_email = $2 OR s.shared_with_email IS NOT NULL)
      `, [planilhaId, email]);
      if (!acc.rows.length) return sendJSON(res, 403, { error: 'Sem acesso' });
      const v = await pgPool.query('SELECT data, saved_by_email, saved_by_name, saved_at FROM nofluxo_planilha_versions WHERE id=$1 AND planilha_id=$2', [versionId, planilhaId]);
      if (!v.rows.length) return sendJSON(res, 404, { error: 'Versão não encontrada' });
      return sendJSON(res, 200, {
        ok: true,
        data: v.rows[0].data,
        savedByEmail: v.rows[0].saved_by_email,
        savedByName: v.rows[0].saved_by_name,
        savedAt: v.rows[0].saved_at,
      });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // Restaura versão (cria nova versão com dados antigos + atualiza planilha)
  if (urlPath.match(/\/versions\/\d+\/restore$/) && req.method === 'POST') {
    if (!SYNC_ENABLED) return sendJSON(res, 503, { error: 'Sync não configurado' });
    try {
      const parts = urlPath.split('/');
      const versionId = parts[parts.length - 3]; // .../versions/ID/restore
      const planilhaId = parts[parts.length - 4]; // .../planilha/ID/versions/ID/restore
      const body = await readBody(req);
      const email = (body.email || '').toLowerCase().trim();
      if (!email) return sendJSON(res, 400, { error: 'Email obrigatório' });
      // Verifica permissão de edição
      const existing = await pgPool.query(`
        SELECT p.owner_email, s.permission
        FROM nofluxo_planilhas p
        LEFT JOIN nofluxo_shares s ON s.planilha_id = p.id AND s.shared_with_email = $2
        WHERE p.id = $1
      `, [planilhaId, email]);
      if (!existing.rows.length) return sendJSON(res, 404, { error: 'Planilha não encontrada' });
      const row = existing.rows[0];
      const isOwner = row.owner_email === email;
      const role = row.permission || (isOwner ? 'owner' : null);
      if (!isOwner && role !== 'editor') return sendJSON(res, 403, { error: 'Sem permissão' });

      // Pega versão antiga
      const v = await pgPool.query('SELECT data FROM nofluxo_planilha_versions WHERE id=$1 AND planilha_id=$2', [versionId, planilhaId]);
      if (!v.rows.length) return sendJSON(res, 404, { error: 'Versão não encontrada' });
      const oldData = v.rows[0].data;
      const ts = Date.now();
      // Salva versão ATUAL como nova versão (antes de sobrescrever) — pra poder desfazer o restore
      const cur = await pgPool.query('SELECT data, name FROM nofluxo_planilhas WHERE id=$1', [planilhaId]);
      if (cur.rows.length) {
        const curData = JSON.stringify(cur.rows[0].data);
        await pgPool.query(`
          INSERT INTO nofluxo_planilha_versions (planilha_id, data, saved_by_email, saved_by_name, size_bytes)
          VALUES ($1, $2, $3, $4, $5)
        `, [planilhaId, curData, email, body.userName || email, curData.length]);
      }
      // Atualiza planilha com dados antigos
      await pgPool.query(`UPDATE nofluxo_planilhas SET data=$1, updated_at=$2 WHERE id=$3`, [JSON.stringify(oldData), ts, planilhaId]);
      // Cria versão para o restore também
      await pgPool.query(`
        INSERT INTO nofluxo_planilha_versions (planilha_id, data, saved_by_email, saved_by_name, size_bytes)
        VALUES ($1, $2, $3, $4, $5)
      `, [planilhaId, JSON.stringify(oldData), email, body.userName || email + ' (restaurou)', JSON.stringify(oldData).length]);
      // Limpa versões antigas (mantém só últimas 50 por planilha)
      await pgPool.query(`
        DELETE FROM nofluxo_planilha_versions
        WHERE planilha_id=$1 AND id NOT IN (
          SELECT id FROM nofluxo_planilha_versions WHERE planilha_id=$1 ORDER BY saved_at DESC LIMIT 50
        )
      `, [planilhaId]);
      return sendJSON(res, 200, { ok: true, data: oldData, updatedAt: ts });
    } catch (err) { return sendJSON(res, 500, { error: 'Erro: ' + err.message }); }
  }

  // === Health check ===
  if (urlPath === '/health' || urlPath === '/ping') {
    return sendJSON(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      groq: GROQ_API_KEY ? 'configurado' : 'não configurado',
      gemini: GEMINI_API_KEY ? 'configurado' : 'não configurado',
      provedor_preferido: PREFERRED_PROVIDER,
      postgres: SYNC_ENABLED ? 'configurado' : 'não configurado (defina DATABASE_URL)',
      sync_ativo: SYNC_ENABLED
    });
  }

  // === Serve o app ===
  if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/nofluxo.html') {
    if (!fs.existsSync(HTML_FILE)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Erro: nofluxo.html não encontrado no servidor.');
    }
    const html = fs.readFileSync(HTML_FILE);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // === 404 ===
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — Página não encontrada');
});

server.listen(PORT, () => {
  console.log(`NoFluxo rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`Agente IA:`);
  console.log(`  Groq:   ${GROQ_API_KEY ? '✓ configurado' : '✗ não configurado (https://console.groq.com/keys)'}`);
  console.log(`  Gemini: ${GEMINI_API_KEY ? '✓ configurado' : '✗ não configurado (https://aistudio.google.com/app/apikey)'}`);
  console.log(`  Provedor preferido: ${PREFERRED_PROVIDER}`);
  if (GROQ_API_KEY) console.log(`  Modelos Groq que serão tentados: ${GROQ_MODELS.join(', ')}`);
  if (GEMINI_API_KEY) console.log(`  Modelos Gemini que serão tentados: ${GEMINI_MODELS.join(', ')}`);
  console.log(`Sync PostgreSQL: ${SYNC_ENABLED ? '✓ ativo (DATABASE_URL configurado)' : '✗ inativo (defina DATABASE_URL no Railway)'}`);
  console.log(`Notificações por email (Resend): ${RESEND_API_KEY ? '✓ ativo (RESEND_API_KEY configurado)' : '✗ inativo — só in-app (defina RESEND_API_KEY + RESEND_FROM_EMAIL)'}`);
  console.log(`Compartilhamento, presença e versões: ${SYNC_ENABLED ? '✓ disponíveis' : '✗ precisam de DATABASE_URL'}`);
});
