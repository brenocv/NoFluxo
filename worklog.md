---
Task ID: main
Agent: super-z (main)
Task: Criar app de controle financeiro a partir da planilha "Porto 2026.xlsx" com sync em tempo real entre dispositivos (Breno e Kiki).

Work Log:
- Lida planilha "Porto 2026.xlsx" (sheet "Despesas") - 23 categorias, 12 meses, moedas BRL+EUR
- Inicializado ambiente fullstack-dev (Next.js 16 + Prisma + SQLite + shadcn/ui)
- Configurado schema Prisma: Category, Transaction (unique por categoria+ano+mês), Config (key/value), ActivityLog
- Criado script de seed (scripts/seed.ts) que importa 171 transações da planilha
- Implementadas API routes: /api/data, /api/transactions, /api/categories, /api/config, /api/activity
- Criado mini-service Socket.io (mini-services/finance-sync, porta 3003) com:
  - Eventos: identify, change (broadcast), presence:list/joined/left
  - Health endpoint /health
- Construída UI mobile-first:
  - Header sticky com badge "Sincronizando"/"Offline" e botão Configurações
  - Seletor de mês (Jan-Dez) horizontal scrollable
  - Card de resumo: saldo total, entradas/saídas BRL+EUR, reservas
  - 5 grupos (Despesas BR, Contas casa PT, Rendimentos BRL, Rendimentos EUR, Reservas) com colapso
  - Modal de edição de transação (valor + nota) com teclado decimal
  - Modal de criar categoria (nome, nota, tipo, moeda)
  - Modal de Configurações (trocar usuário Breno/Kiki/Visita + câmbio Euro)
  - Painel de atividade recente com presença online
- Hook useFinanceData aplica patches locais + broadcasts remotos via socket
- Hook useCurrentUser usa useSyncExternalStore para persistir identidade em localStorage
- Acessibilidade: DialogDescription em todos os diálogos (sr-only quando não visível)
- Validação completa com Agent Browser (iPhone 14):
  - Página carrega com dados da planilha ✓
  - Troca de mês funciona ✓
  - Edição de transação salva e atualiza UI ✓
  - Criação de categoria funciona ✓
  - Troca de usuário funciona ✓
  - Sync em tempo real entre duas sessões (Breno e Kiki) ✓ (edit em uma aparece na outra)
  - Activity panel registra quem fez cada alteração ✓

Stage Summary:
- App totalmente funcional com sincronização bidirecional em tempo real via Socket.io
- 23 categorias + 171 transações importadas da planilha original
- Cada dispositivo escolhe sua identidade (Breno/Kiki) em Configurações
- Activity log registra todas as mudanças com autor e timestamp
- Suporte a múltiplas moedas (BRL/EUR) com câmbio configurável
- Layout 100% mobile-first, otimizado para uso no celular
