# Porto 2026 — Controle Financeiro

App de controle financeiro compartilhado em tempo real entre dois dispositivos (Breno e Kiki), com sincronização instantânea via Socket.io.

## Funcionalidades

- **Sincronização em tempo real** entre dispositivos via Socket.io
- **Múltiplas moedas** (R$ e €) com câmbio configurável
- **Categorias aninhadas** com profundidade ilimitada (grupos → subgrupos → sub-subgrupos → categorias → sub-categorias)
- **Transações recorrentes** com ou sem parcelas (atravessa anos)
- **Saldo do mês anterior** carrega automaticamente para o próximo mês
- **Gráfico de barras** mensal (entradas x saídas)
- **Gráfico de pizza** com drill-down (clique para ver sub-itens)
- **Dashboard anual** com evolução do saldo acumulado
- **Meta de poupança anual** com barra de progresso
- **Alertas de vencimento** (parse de "vence dia X")
- **Notificações push** para vencimentos próximos
- **Caderninho de anotações** com linhas pautadas (um por mês, pode ser recorrente)
- **Busca por highlight** (destaca matches, ofusca o resto)
- **Undo/Redo** (Ctrl+Z / Ctrl+Y) com 25 ações
- **Mover categorias** entre grupos
- **Copiar mês** para outro mês/ano
- **Zerar valores** (mês ou ano inteiro)
- **Exportar Excel** (.xlsx)
- **Backup JSON** (exportar/importar completo)
- **Dark mode**
- **Renomeação** de qualquer grupo, subgrupo ou categoria
- **Indentação escada** com cores hierárquicas por profundidade
- **Multi-ano** (navegação ← 2026 →)
- **Identidade por dispositivo** (Breno / Kiki / Visita)

## Deploy

### Opção 1: Vercel (recomendado)

1. Crie uma conta em [vercel.com](https://vercel.com)
2. Instale a CLI: `npm i -g vercel`
3. Extraia o ZIP, entre na pasta e rode:
   ```bash
   vercel
   ```
4. Configure as variáveis de ambiente:
   - `DATABASE_URL` — URL do banco SQLite (use um serviço como Turso ou PlanetScale para persistência)
5. Para o Socket.io, você precisará de um serviço separado (Vercel não suporta WebSockets nativamente). Opções:
   - Use [Railway](https://railway.app) para hospedar o mini-service `mini-services/finance-sync`
   - Ou use [Pusher](https://pusher.com) / [Ably](https://ably.com) como alternativa

### Opção 2: Railway / Render (suporta WebSockets)

1. Crie uma conta em [railway.app](https://railway.app) ou [render.com](https://render.com)
2. Conecte seu repositório Git
3. Configure:
   - **Build command**: `bun install && bun run db:push`
   - **Start command**: `bun run dev` (ou `bun run start` em produção)
   - **Variáveis**: `DATABASE_URL=file:./db/custom.db`
4. O Socket.io service roda na mesma instância (porta 3003)

### Opção 3: VPS (DigitalOcean, Hetzner, etc.)

1. Extraia o ZIP no servidor
2. Instale Node.js 20+ e Bun
3. Rode:
   ```bash
   bun install
   bun run db:push
   bun run dev  # ou bun run build && bun run start
   ```
4. O Caddyfile já está configurado para rotear portas (3000 = Next.js, 3003 = Socket.io)

## Setup após deploy

1. **Importar dados da planilha**: rode `bun run scripts/seed.ts` para importar os dados de `upload/Porto 2026.xlsx`
2. **Configurar câmbio**: clique no botão Configurações e ajuste a cotação do Euro
3. **Cada dispositivo escolhe sua identidade**: Breno ou Kiki em Configurações

## Estrutura do projeto

```
src/
├── app/
│   ├── api/                  # API routes (REST)
│   │   ├── data/             # GET /api/data — estado completo
│   │   ├── transactions/     # POST — CRUD de transações
│   │   ├── categories/       # POST/PATCH/DELETE — CRUD de categorias
│   │   ├── subgroups/        # POST/DELETE — subgrupos
│   │   ├── labels/           # GET/PATCH — renomeação
│   │   ├── config/           # PATCH — config (câmbio, etc)
│   │   ├── notes/            # GET/POST/DELETE — caderninho
│   │   ├── budget/           # GET/POST — meta de poupança
│   │   ├── backup/           # GET — exportar JSON
│   │   ├── backup/import/    # POST — importar JSON
│   │   ├── export/           # GET — exportar Excel
│   │   ├── previous-month-balance/  # GET — saldo mês anterior
│   │   └── activity/         # GET — log de atividade
│   ├── layout.tsx
│   ├── page.tsx              # Página principal
│   └── globals.css
├── components/
│   ├── finance/              # Componentes da UI financeira
│   ├── theme-provider.tsx    # Dark mode
│   ├── theme-toggle.tsx
│   └── ui/                   # shadcn/ui components
├── hooks/
│   ├── use-finance-data.ts   # Hook principal (estado + sync)
│   ├── use-current-user.ts   # Identidade do dispositivo
│   ├── use-action-history.ts # Undo/redo
│   └── use-vencimento-notifications.ts  # Push notifications
└── lib/
    ├── finance.ts            # Tipos, helpers, árvore de grupos
    ├── actions.ts            # API client functions
    ├── db.ts                 # Prisma client
    ├── socket.ts             # Socket.io client
    └── utils.ts

mini-services/
└── finance-sync/             # Serviço Socket.io (porta 3003)

prisma/
└── schema.prisma             # Schema do banco (SQLite)
```

## Tecnologias

- **Next.js 16** (App Router, TypeScript)
- **Prisma ORM** + SQLite
- **Socket.io** (sincronização em tempo real)
- **shadcn/ui** + Tailwind CSS 4
- **Recharts** (gráficos)
- **XLSX** (export Excel)
- **next-themes** (dark mode)
- **Sonner** (toasts)
