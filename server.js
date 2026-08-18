// NoFluxo — servidor Node.js simples para servir o app + API do agente IA
// Usa apenas módulos nativos do Node (sem dependências externas)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'nofluxo.html');

// Chave do Google Gemini — criar em https://aistudio.google.com/app/apikey
// Configure como variável de ambiente GEMINI_API_KEY no Railway
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
// Lista de modelos para tentar (em ordem de preferência). Se um falhar com "no longer available",
// automaticamente tenta o próximo.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
let GEMINI_MODEL_PREF = (process.env.GEMINI_MODEL || '').trim();

// Chave do Groq (Llama 3.3 70B) — criar em https://console.groq.com/keys
// GRATUITO e muito mais generoso que o Gemini (7000 req/dia vs 1500 do Gemini free)
// Configure como variável de ambiente GROQ_API_KEY no Railway
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

// Provedor preferido: 'groq' ou 'gemini'. Pode ser forçado via LLM_PROVIDER no env.
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
  txt += '- Quando o usuário perguntar "em que mês minha dívida termina", calcule o mês exato a partir dos dados das dívidas recorrentes.\n';
  txt += '- Quando perguntar sobre saldo, reserve, metas — use os valores reais do usuário.\n';
  txt += '- Se precisar de informações externas (taxas, conceitos financeiros, notícias), use a busca do Google (já está habilitada automaticamente).\n';
  txt += '- Seja breve: máximo 4-5 parágrafos curtos. Use bullet points quando apropriado.\n';
  txt += '- Nunca invente números. Se não souber, diga que precisa de mais dados.\n';
  return txt;
}

// Chama o Groq (API compatível com OpenAI) — não tem web search, mas é mais rápido e generoso
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

  let lastError = '';
  for (const model of GROQ_MODELS) {
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
      if (resp.status === 404 || resp.status === 400) {
        const e = await resp.text();
        let msg = e;
        try { const j = JSON.parse(e); msg = j.error?.message || e; } catch (_) {}
        console.log(`Groq modelo ${model} falhou (HTTP ${resp.status}): ${msg}`);
        lastError = `${model}: ${msg}`;
        continue;
      }
      if (resp.status === 401) {
        const e = await resp.text();
        let msg = e;
        try { const j = JSON.parse(e); msg = j.error?.message || e; } catch (_) {}
        return { error: `Groq API key inválida (401): ${msg}` };
      }
      if (resp.status === 429) {
        const e = await resp.text();
        let msg = e;
        try { const j = JSON.parse(e); msg = j.error?.message || e; } catch (_) {}
        console.log(`Groq modelo ${model} rate-limit: ${msg}`);
        lastError = `${model} rate-limit: ${msg}`;
        continue;
      }
      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Groq API erro ${resp.status}`;
        try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch (_) {}
        if (/quota|exceeded|limit|insufficient/i.test(errMsg)) {
          return { error: `Groq quota excedida: ${errMsg}` };
        }
        lastError = `${model}: ${errMsg}`;
        continue;
      }
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) { lastError = `${model}: resposta vazia`; continue; }
      console.log(`Agente respondeu usando Groq ${model}`);
      return { response: text };
    } catch (err) {
      console.log(`Erro ao chamar Groq ${model}: ${err.message}`);
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }
  return { error: `Todos os modelos Groq falharam. Último erro: ${lastError}` };
}

// Chama o Gemini (tem web search nativo) — fallback do Groq
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
  const modelsToTry = GEMINI_MODEL_PREF ? [GEMINI_MODEL_PREF, ...GEMINI_MODELS.filter(m => m !== GEMINI_MODEL_PREF)] : GEMINI_MODELS;
  let lastError = '';
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (resp.status === 404 || resp.status === 400) {
        const errText = await resp.text();
        let msg = errText;
        try { const j = JSON.parse(errText); msg = j.error?.message || errText; } catch (_) {}
        console.log(`Gemini modelo ${model} falhou (HTTP ${resp.status}): ${msg}`);
        lastError = `${model}: ${msg}`;
        continue;
      }
      if (resp.status === 403 || resp.status === 401) {
        // API key inválida OU API não habilitada no projeto
        const errText = await resp.text();
        let msg = errText;
        try { const j = JSON.parse(errText); msg = j.error?.message || errText; } catch (_) {}
        return { error: `Gemini API key inválida ou API não habilitada (${resp.status}): ${msg}. Verifique em https://console.cloud.google.com/apis/library generativelanguage.googleapis.com está habilitado.` };
      }
      if (resp.status === 429) {
        const errText = await resp.text();
        let msg = errText;
        try { const j = JSON.parse(errText); msg = j.error?.message || errText; } catch (_) {}
        console.log(`Gemini ${model} rate-limit: ${msg}`);
        lastError = `${model} rate-limit: ${msg}`;
        continue;
      }
      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Gemini API erro ${resp.status}`;
        try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch (_) {}
        if (/no longer available|not found|not supported|deprecated/i.test(errMsg)) {
          lastError = `${model}: ${errMsg}`;
          continue;
        }
        if (/quota|exceeded|limit/i.test(errMsg)) {
          return { error: `Gemini quota excedida: ${errMsg}` };
        }
        lastError = `${model}: ${errMsg}`;
        continue;
      }
      const data = await resp.json();
      const candidates = data.candidates || [];
      if (!candidates.length) { lastError = `${model}: sem candidatos`; continue; }
      const parts = candidates[0].content?.parts || [];
      let text = parts.filter(p => p.text).map(p => p.text).join('\n');
      const grounding = candidates[0].groundingMetadata;
      if (grounding && grounding.webSearchQueries && grounding.webSearchQueries.length) {
        text += '\n\n_(resposta com base em busca web em tempo real)_';
      }
      console.log(`Agente respondeu usando Gemini ${model}`);
      return { response: text || 'Não consegui gerar uma resposta. Tente reformular.' };
    } catch (err) {
      console.log(`Erro ao chamar Gemini ${model}: ${err.message}`);
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }
  return { error: `Todos os modelos Gemini falharam. Último erro: ${lastError}` };
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

  // === Health check ===
  if (urlPath === '/health' || urlPath === '/ping') {
    return sendJSON(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      groq: GROQ_API_KEY ? 'configurado' : 'não configurado',
      gemini: GEMINI_API_KEY ? 'configurado' : 'não configurado',
      provedor_preferido: PREFERRED_PROVIDER
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
});
