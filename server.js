// NoFluxo — servidor Node.js simples para servir o app + API do agente IA
// Usa apenas módulos nativos do Node (sem dependências externas)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'nofluxo.html');

// Chave do Google Gemini — criar em https://aistudio.google.com/app/apikey
// Configure como variável de ambiente GEMINI_API_KEY no Railway
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Lista de modelos para tentar (em ordem de preferência). Se um falhar com "no longer available",
// automaticamente tenta o próximo.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
let GEMINI_MODEL_PREF = process.env.GEMINI_MODEL || ''; // pode forçar um específico via env

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

// Chama a API do Google Gemini — tenta múltiplos modelos automaticamente
async function callGemini(userMessage, context, history) {
  if (!GEMINI_API_KEY) {
    return { error: 'Agente IA precisa da chave GEMINI_API_KEY configurada. Peça ao administrador para criar uma chave em https://aistudio.google.com/app/apikey e adicionar como variável de ambiente GEMINI_API_KEY no Railway.' };
  }
  const systemPrompt = buildSystemPrompt(context);
  // Monta o contents (Gemini usa array de mensagens)
  const contents = [];
  if (history && Array.isArray(history)) {
    history.forEach(h => {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    tools: [{ google_search: {} }], // habilita web search (respostas com info atualizada)
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1500,
    }
  };

  // Lista de modelos a tentar: o preferido do env, depois a ordem padrão
  const modelsToTry = GEMINI_MODEL_PREF ? [GEMINI_MODEL_PREF, ...GEMINI_MODELS.filter(m => m !== GEMINI_MODEL_PREF)] : GEMINI_MODELS;
  let lastError = '';

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      // Se 404 ou "no longer available", tenta próximo modelo
      if (resp.status === 404) {
        console.log(`Modelo ${model} não encontrado (404), tentando próximo...`);
        lastError = `Modelo ${model} não disponível`;
        continue;
      }
      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Gemini API erro ${resp.status}`;
        try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch (_) {}
        // Se a mensagem indica que o modelo não está disponível, tenta próximo
        if (/no longer available|not found|not supported|deprecated/i.test(errMsg)) {
          console.log(`Modelo ${model} indisponível: ${errMsg}. Tentando próximo...`);
          lastError = errMsg;
          continue;
        }
        return { error: errMsg };
      }
      const data = await resp.json();
      const candidates = data.candidates || [];
      if (!candidates.length) { lastError = 'Sem resposta do modelo.'; continue; }
      const parts = candidates[0].content?.parts || [];
      let text = parts.filter(p => p.text).map(p => p.text).join('\n');
      const grounding = candidates[0].groundingMetadata;
      if (grounding && grounding.webSearchQueries && grounding.webSearchQueries.length) {
        text += '\n\n_(resposta com base em busca web em tempo real)_';
      }
      console.log(`Agente respondeu usando modelo: ${model}`);
      return { response: text || 'Não consegui gerar uma resposta. Tente reformular.' };
    } catch (err) {
      console.log(`Erro ao chamar ${model}: ${err.message}`);
      lastError = err.message;
      continue;
    }
  }
  return { error: 'Não foi possível chamar nenhum modelo Gemini disponível. Último erro: ' + lastError };
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
      const result = await callGemini(message, context || {}, history || []);
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
      gemini: GEMINI_API_KEY ? 'configurado' : 'não configurado'
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
  console.log(`Agente IA: ${GEMINI_API_KEY ? 'ativo (Gemini configurado)' : 'inativo (configure GEMINI_API_KEY)'}`);
  if (GEMINI_API_KEY) console.log(`Modelos que serão tentados em ordem: ${GEMINI_MODELS.join(', ')}`);
});
