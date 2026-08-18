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
7. Pronto! Seu app está no ar 🎉

## Estrutura do projeto

```
nofluxo/
├── nofluxo.html    # App completo (HTML + CSS + JS em um único arquivo)
├── server.js       # Servidor Node.js (sem dependências externas)
├── package.json    # Configuração do projeto
├── Procfile        # Comando de start para o Railway
├── .gitignore      # Arquivos ignorados pelo Git
└── README.md       # Este arquivo
```

## Características

- **Single-file HTML** — todo o app em um único arquivo `nofluxo.html`
- **localStorage** — dados persistem no navegador do usuário
- **Multi-usuário** — sistema de login com hash de senha
- **Multi-planilha** — cada usuário pode ter várias planilhas independentes
- **Importação** — extrato bancário (CSV/OFX), fatura de cartão (Nubank, etc.), planilhas (Excel/Google Sheets)
- **Dark mode** — tema claro e escuro
- **Moedas** — suporte a múltiplas moedas com conversão (bandeiras via flagcdn.com)
- **PWA** — instalável no PC e celular
- **Undo/Redo** — histórico completo de ações

## Backup dos dados

Como os dados ficam no navegador (localStorage), use o menu **Backup (JSON)** para exportar tudo periodicamente.
Para restaurar, use o menu **Restaurar**.

## Tecnologias

- HTML5 + CSS3 + JavaScript vanilla (sem frameworks)
- SheetJS (XLSX) carregado via CDN para importar Excel
- Servidor Node.js nativo (sem Express, sem dependências)
