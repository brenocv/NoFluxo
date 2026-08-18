# NoFluxo

App de controle financeiro pessoal — single file HTML com localStorage.
Multi-usuário, multi-planilha, importação de extratos e faturas de cartão.

## Como rodar localmente

```bash
# Não precisa instalar nada (sem dependências externas)
node server.js
```

Acesse: http://localhost:3000

## Deploy no Railway

1. Suba este repositório para o GitHub
2. No [Railway](https://railway.app), crie um novo projeto
3. Selecione **Deploy from GitHub repo** → escolha este repositório
4. Railway detecta o `package.json` automaticamente
5. Clique em **Deploy**
6. Em **Settings → Networking**, clique em **Generate Domain**
7. Configure as variáveis de ambiente (ver abaixo)
8. Pronto! Seu app está no ar 🎉

## Variáveis de ambiente (Railway → Settings → Variables)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GROQ_API_KEY` | **Recomendada** (gratuita, mais generosa) | Chave do Groq (Llama 3.3 70B) — 7000 req/dia grátis |
| `GEMINI_API_KEY` | Opcional (gratuita, menos generosa) | Chave do Google Gemini — 1500 req/dia grátis, com web search |
| `LLM_PROVIDER` | Opcional | `groq` (padrão) ou `gemini` — qual usar primeiro |

> **Dica**: configure as duas! Se uma cair por rate limit, a outra assume automaticamente.

### Como obter a `GROQ_API_KEY` (recomendado, mais gratuito)

1. Acesse https://console.groq.com/keys
2. Faça login com **GitHub** ou **Google** (1 clique)
3. Clique em **Create API Key** → dê um nome (ex: "nofluxo")
4. Copie a chave (formato: `gsk_...`)
5. No Railway: Settings → Variables → Add → Name: `GROQ_API_KEY`, Value: cole a chave
6. Salve → Railway redeployar automaticamente

**Limites gratuitos do Groq:**
- Llama 3.3 70B: 1000 req/dia, 30 req/min
- Llama 3.1 8B: 7000 req/dia, 30 req/min
- Mixtral 8x7B: 2000 req/dia

### Como obter a `GEMINI_API_KEY` (opcional, com web search)

1. Acesse https://aistudio.google.com/app/apikey
2. Faça login com sua conta Google (pode ser a mesma do deploy)
3. Clique em **Create API key**
4. Selecione um projeto (pode ser o mesmo do login Google)
5. Copie a chave (formato: `AIzaSy...`)
6. No Railway: Settings → Variables → Add → Name: `GEMINI_API_KEY`, Value: cole a chave
7. Salve → Railway vai redeployar automaticamente

**Limites gratuitos do Gemini** (mais baixos, mas tem web search):
- gemini-3.6-flash: 1500 req/dia, 15 req/min
- Tem busca na web nativa (responde perguntas sobre taxas atuais, notícias, etc.)

Sem nenhuma chave, o agente mostra uma mensagem explicando como configurar.
O resto do app (login, finanças, importação, etc.) funciona sem chaves.

## Estrutura do projeto

```
nofluxo/
├── nofluxo.html    # App completo (HTML + CSS + JS em um único arquivo)
├── server.js       # Servidor Node.js + API do agente IA (Gemini)
├── package.json    # Configuração do projeto
├── Procfile        # Comando de start para o Railway
├── railway.json    # Configuração específica do Railway
├── .gitignore      # Arquivos ignorados pelo Git
├── LICENSE         # Licença MIT
└── README.md       # Este arquivo
```

## Características

- **Single-file HTML** — todo o app em um único arquivo `nofluxo.html`
- **localStorage** — dados persistem no navegador do usuário
- **Multi-usuário** — login com e-mail/senha OU login com Google (OAuth2)
- **Multi-planilha** — cada usuário pode ter várias planilhas independentes
- **Importação** — extrato bancário (CSV/OFX), fatura de cartão (Nubank, etc.), planilhas (Excel/Google Sheets)
- **Dark mode** — tema claro e escuro
- **Moedas** — suporte a múltiplas moedas com conversão (bandeiras via flagcdn.com)
- **Metas** — defina metas mensais por subgrupo OU por item individual, com barra de progresso
- **Valores a receber** — itens pendentes aparecem em todos os meses até serem recebidos
- **Agente IA** — assistente com Gemini (calcula prazos de dívida, responde perguntas, busca na web)
- **PWA** — instalável no PC e celular, com ícone próprio
- **Undo/Redo** — histórico completo de ações

## Agente IA

Botão flutuante no canto inferior direito (azul) abre um chat com o assistente. Ele:

- Calcula em que mês suas dívidas parceladas terminam
- Mostra saldo, metas, valores pendentes
- Busca informações na web em tempo real (taxas, conceitos financeiros) — apenas com Gemini
- Sugere ajustes no seu orçamento

Usa **dois provedores** com fallback automático:
1. **Groq** (Llama 3.3 70B) — mais rápido, 1000 req/dia grátis, login com GitHub/Google
2. **Google Gemini 2.0/3.6 Flash** — com web search nativo, 1500 req/dia grátis

Se um cair por rate limit, automaticamente tenta o outro. Configure as duas chaves para ter máxima disponibilidade.

## Backup dos dados

Como os dados ficam no navegador (localStorage), use o menu **Backup (JSON)** para exportar tudo periodicamente.
Para restaurar, use o menu **Restaurar**.

## Tecnologias

- HTML5 + CSS3 + JavaScript vanilla (sem frameworks)
- SheetJS (XLSX) carregado via CDN para importar Excel
- Google Identity Services (GIS) para login com Google
- Google Gemini AI Studio para o agente IA (gratuito)
- Servidor Node.js nativo (sem Express, sem dependências)
