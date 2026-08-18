// NoFluxo — servidor Node.js simples para servir o app estático
// Usa apenas módulos nativos do Node (sem dependências externas)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'nofluxo.html');

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

const server = http.createServer((req, res) => {
  // Log simples ( Railway pega automaticamente via stdout )
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  // Rota principal → serve o app
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/nofluxo.html') {
    if (!fs.existsSync(HTML_FILE)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro: nofluxo.html não encontrado no servidor.');
      return;
    }
    const html = fs.readFileSync(HTML_FILE);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Rota de health check (Railway usa para saber se o app está vivo)
  if (urlPath === '/health' || urlPath === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // 404 para qualquer outra rota
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — Página não encontrada');
});

server.listen(PORT, () => {
  console.log(`NoFluxo rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
