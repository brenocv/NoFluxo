# 🚀 Deploy no Railway — Passo a Passo

Este guia mostra como hospedar o app de controle financeiro no Railway (grátis) para que o Breno e a Kiki possam acessar de qualquer celular.

---

## Pré-requisitos

1. **Conta no GitHub** (grátis em [github.com](https://github.com))
2. **Conta no Railway** (grátis em [railway.app](https://railway.app) — faça login com GitHub)

---

## Passo 1: Subir o código para o GitHub

### Opção A: Criar um novo repositório

1. Acesse [github.com/new](https://github.com/new)
2. Nome: `porto-finance`
3. Marque **"Private"** (recomendado — seus dados financeiros)
4. Clique em **"Create repository"**
5. No terminal (na pasta do projeto):

```bash
git init
git add .
git commit -m "App de controle financeiro - Porto 2026"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/porto-finance.git
git push -u origin main
```

### Opção B: Se já tem o repo, apenas faça `git push`

```bash
git add .
git commit -m "Migrar para PostgreSQL + Railway deploy"
git push
```

---

## Passo 2: Criar o projeto no Railway

1. Acesse [railway.app](https://railway.app) e clique em **"New Project"**

2. Selecione **"Deploy from GitHub repo"**

3. Escolha o repositório `porto-finance`

4. O Railway vai detectar o Next.js automaticamente e começar o build

---

## Passo 3: Adicionar o banco PostgreSQL

1. No painel do projeto, clique em **"+" (New)**

2. Selecione **"Database"** → **"PostgreSQL"**

3. O Railway cria o banco automaticamente e gera a `DATABASE_URL`

4. Clique no serviço **PostgreSQL** → aba **"Connect"** → copie a **"Postgres Connection URL"** (formato: `postgresql://...`)

---

## Passo 4: Configurar variáveis de ambiente

1. Clique no serviço do seu app (não no PostgreSQL)

2. Vá na aba **"Variables"**

3. Adicione:
   ```
   DATABASE_URL = <cole a URL do PostgreSQL aqui>
   ```

4. O Railway já define `PORT` automaticamente — não precisa adicionar

---

## Passo 5: Aguardar o build e deploy

1. O Railway faz o build automaticamente:
   - `bun install` (instala dependências)
   - `bun run build` (gera Prisma client + builda o Next.js)
   - `node server.js` (inicia o servidor com Socket.io integrado)

2. Acompanhe o progresso na aba **"Deployments"**

3. Quando terminar, você verá um **domínio público** (algo como `porto-finance.up.railway.app`)

---

## Passo 6: Criar as tabelas no banco

Depois do primeiro deploy, você precisa criar as tabelas:

### Opção A: Via Railway Console (mais simples)

1. Clique no serviço **PostgreSQL** → aba **"Query"**
2. Não — mais fácil via CLI. Veja Opção B.

### Opção B: Via Railway CLI

1. Instale a CLI do Railway:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. Na pasta do projeto:
   ```bash
   railway link  # conecta ao seu projeto
   railway run bun run db:push  # cria as tabelas
   ```

### Opção C: Via variável de ambiente (automático)

1. Adicione uma variável no seu app:
   ```
   AUTO_SEED = true
   ```

2. Faça um novo deploy (redploy pelo Railway)

3. O app vai criar as tabelas automaticamente no primeiro acesso

---

## Passo 7: Testar o app

1. Acesse a URL pública: `https://porto-finance.up.railway.app`

2. O app vai carregar vazio (sem dados) — isso é normal, é um banco novo

3. Para importar os dados do arquivo Porto 2026.xlsx:
   - Use o botão **"Backup"** → **"Importar"** no app
   - Selecione o arquivo JSON de backup (exportado da versão local)

---

## Passo 8: Instalar como app no celular

### No iPhone (Safari):
1. Abra `https://porto-finance.up.railway.app` no Safari
2. Toque em **Compartilhar** → **"Adicionar à Tela de Início"**
3. Pronto! App na tela inicial, tela cheia

### No Android (Chrome):
1. Abra a URL no Chrome
2. Menu **⋮** → **"Adicionar à tela inicial"** ou **"Instalar app"**
3. Pronto!

---

## Estrutura do deploy

```
Railway
├── App (Next.js + Socket.io integrado)
│   ├── Frontend (páginas React)
│   ├── API Routes (Prisma → PostgreSQL)
│   └── Socket.io (sync em tempo real)
│
└── PostgreSQL
    └── Banco de dados (categorias, transações, etc.)
```

Tudo roda no mesmo servidor: o `server.js` (custom server) inicia o Next.js e o Socket.io juntos na mesma porta.

---

## Variáveis de ambiente necessárias

| Variável | Onde obter | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | Railway PostgreSQL → Connect → Connection URL | ✅ |
| `PORT` | Railway define automaticamente | ✅ (auto) |

---

## Problemas comuns

### "Build failed: Prisma generate"
- O `postinstall` roda `prisma generate` automaticamente
- Se falhar, adicione `DATABASE_URL` como variável antes do build

### "App carrega mas não sincroniza"
- O Socket.io está integrado no `server.js`
- Verifique se o `server.js` está sendo usado (não o `next start`)

### "Erro de conexão com banco"
- Verifique se a `DATABASE_URL` está correta
- O formato deve ser: `postgresql://user:pass@host:port/db`

### "Dados sumiram após redeploy"
- O PostgreSQL do Railway é **persistente** — os dados não somem
- Se usou SQLite em desenvolvimento, os dados não migram automaticamente
- Use Backup → Exportar (na versão local) → Importar (na versão Railway)

---

## Custos

- **Railway grátis:** $5 de crédito por mês
- Um app pequeno como este consome ~$3-4/mês
- Se acabar o crédito, o app "dorme" até o próximo mês
- Para uso familiar (2-3 pessoas), o plano grátis é suficiente

---

## Próximos passos

1. ✅ Deploy no Railway
2. ✅ Instalar PWA nos celulares
3. ✅ Breno e Kiki acessam de qualquer lugar
4. ✅ Sync em tempo real entre dispositivos
5. ✅ Dados persistentes no PostgreSQL

Bom uso! 🎉
