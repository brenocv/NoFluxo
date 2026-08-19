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
  // Inicializa a tabela de usuários
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS nofluxo_users (
      email VARCHAR(255) PRIMARY KEY,
      google_id VARCHAR(255) UNIQUE,
      google_name VARCHAR(255),
      google_picture TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      client_updated_at BIGINT NOT NULL DEFAULT 0,
      server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => console.log('✓ Tabela nofluxo_users pronta'))
    .catch(e => console.error('Erro ao criar tabela:', e.message));
}

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'nofluxo.html');

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

// Chave do Groq (Llama 3.3 70B) — criar em https://console.groq.com/keys
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
// Lista de modelos Groq (atualizada 2025). Tentados em ordem.
// NOTA: deepseek-r1-distill-llama-70b é um "reasoning model" que mostra o raciocínio
// antes de responder — não usamos por padrão, mas pode ser forçado via GROQ_MODEL no env.
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
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
      /llama|gemma|deepseek|qwen/i.test(id) && !/whisper|guard|mixtral/i.test(id)
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

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  let urlPath = req.url.split('?')[0];

  // CORS (caso o app seja servido de outro domínio no futuro)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

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

  // === Debug — mostra configuração detalhada (sem expor chaves) ===
  if (urlPath === '/api/debug' && req.method === 'GET') {
    return sendJSON(res, 200, {
      groq: {
        configurado: !!GROQ_API_KEY,
        tamanho_chave: GROQ_API_KEY.length,
        comeca_com: GROQ_API_KEY ? GROQ_API_KEY.slice(0, 8) + '...' : '',
        modelos: GROQ_MODELS
      },
      gemini: {
        configurado: !!GEMINI_API_KEY,
        tamanho_chave: GEMINI_API_KEY.length,
        comeca_com: GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 10) + '...' : '',
        modelos: GEMINI_MODELS
      },
      provedor_preferido: PREFERRED_PROVIDER,
      node_version: process.version,
      timestamp: new Date().toISOString()
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
});
