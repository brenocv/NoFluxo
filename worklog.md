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

---
Task ID: v2
Agent: super-z (main)
Task: Adicionar gráfico de barras, busca, separar "Caixinha do Breno" em "Valores a receber" com toggle, adicionar categorias faltantes de Contas casa, mostrar valores em dupla moeda (R$ + €), corrigir câmbio para 6.

Work Log:
- Inspecionada planilha: identificadas 5 categorias faltantes em Contas casa (rows 42-46): Plano Tetê e Limão, Turminha rações, Mesada Kiki, Mesada Breno, Wizink
- Schema Prisma: adicionado campo `excludeFromTotal Boolean @default(false)` em Category
- Seed atualizado:
  - Euro rate: 6 (em vez de 6.4)
  - "Caixinha Breno" movida para grupo "valores_a_receber" com excludeFromTotal=true
  - 5 novas categorias em contas_casa (todas em EUR como as demais)
  - Total: 28 categorias, 223 transações (antes 23/171)
- Tipos TypeScript: adicionado 'valores_a_receber' em CategoryGroup e GROUP_LABELS/ORDER
- Helpers de formatação: formatDual() e formatDualCompact() para mostrar "R$ X (€ Y)" ou "€ X (R$ Y)"
- SummaryCard reescrito:
  - Saldo total em R$ com equivalente em € abaixo
  - Cada fluxo (entradas/saídas/saldos) mostra valor principal + conversão entre parênteses
  - Toggle "Incluir valores a receber" com Switch (persistido em localStorage)
  - Badge "(com/sem valores a receber)" no rótulo do saldo
  - Reservas mostra dupla moeda
- GroupCard atualizado:
  - Total do grupo em dupla moeda: "−R$ 6.555 (€ 1.092,50)"
  - Cada valor mostra linha principal + linha menor com conversão
  - Badge "a receber" para o grupo valores_a_receber
  - Tratamento de sinal para valores_a_receber (sem prefixo +/−)
- TransactionEditor: preview em dupla moeda (≈ € X ou ≈ R$ Y)
- Novo componente SearchBar:
  - Input com ícone de lupa
  - Botão X para limpar
  - Contador de resultados
- Novo componente MonthlyChart (recharts):
  - BarChart com Entradas (verde) x Saídas (vermelho) para os 12 meses
  - Tooltip customizado mostrando entradas, saídas, saldo em R$ e €
  - Faixa clicável abaixo do gráfico para trocar o mês selecionado
- Página principal atualizada:
  - Estado: search, showOnlyFilled, includeReceivables (persistido)
  - Cálculo de receivablesBRL/EUR separado do saldo normal
  - chartData memoizado com 12 meses de entradas/saídas em BRL
  - visibleGroups filtra grupos sem categorias correspondentes à busca
- API /api/categories: aceita excludeFromTotal em POST e PATCH
- actions.ts: SaveCategoryArgs inclui excludeFromTotal
- CategoryEditor: defaults para valores_a_receber (INCOME+BRL), marca excludeFromTotal=true automaticamente
- db.ts: versão do cache global para forçar re-instantiation quando Prisma client muda
- Reiniciado dev server para pick-up do novo Prisma client

Stage Summary:
- 5 categorias faltantes adicionadas em Contas casa (28 total)
- Câmbio corrigido para R$ 6,00/Euro
- Todos os valores mostrados em dupla moeda (R$ + €)
- "Caixinha Breno" separada em "Valores a receber" com toggle on/off
- Gráfico de barras mensal com 12 meses, interativo (clique para trocar mês)
- Busca funcional por nome/nota das categorias
- Toggle "Mostrar só preenchidos" para focar no que tem valor
- Validação Agent Browser: busca ✓, toggle ✓, gráfico ✓, sync em tempo real ✓
