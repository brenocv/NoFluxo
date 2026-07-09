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

---
Task ID: v3
Agent: super-z (main)
Task: Adicionar metas mensais, export Excel, gráfico de pizza, simplificar saldo, transações recorrentes com parcelas, reestruturar grupos (subgrupos), renomeação de tudo.

Work Log:
- Schema: adicionado monthlyGoal em Category; adicionado isRecurring/seriesId/installmentNumber/installmentsTotal em Transaction
- Grupos reestruturados para hierarquia com pontos:
  - despesas.cartoes (Cartões BR), despesas.contas_casa (Contas casa)
  - rendimentos.brl (Em Real), rendimentos.eur (Em Euro), rendimentos.valores_a_receber (Valores a receber)
  - reservas (sem subgrupos)
- Novos helpers: getTopGroup, getSubgroup, getTopGroupLabel, getGroupLabel, GROUP_STRUCTURE, TOP_GROUP_ORDER
- Labels system: Config key='labels' armazena JSON com renomeações de grupos/subgrupos
  - API /api/labels (GET/PATCH), key="group:despesas" ou "subgroup:despesas.contas_casa"
  - Hook useFinanceData trata type='label' em ChangeMessage
- APIs novas:
  - POST /api/transactions com isRecurring + installmentsTotal: cria múltiplas transações
  - POST /api/transactions/series-stop: para recorrência, remove parcelas futuras
  - GET /api/export: gera .xlsx com XLSX, retorna download
  - PATCH /api/categories: aceita monthlyGoal
  - GET/PATCH /api/labels
- SummaryCard simplificado: removidos "Saldo BRL" e "Saldo EUR" separados — apenas "Saldo total" consolidado em R$ com € equivalente
- TopGroupCard (novo): renderiza grupo top-level com subgrupos aninhados
  - Cada subgrupo tem header próprio com total e collapse independente
  - RenameButton (Popover) em cada grupo e subgrupo
  - CategoryRow mostra badge "recorrente 1/3" e "meta" quando aplicável
  - Botão "Parar recorrência" visível em hover para transações recorrentes
- TransactionEditor expandido:
  - Toggle "Recorrente" + campo "Nº de parcelas" (vazio = até dezembro)
  - Quando editando recorrente: toggle disabled, mostra botão "Parar recorrência"
  - Seção expansível "Editar categoria e meta": renomeia categoria, nota, meta mensal
  - Alerta visual quando valor ultrapassa meta
- CategoryEditor: seletor de grupo hierárquico, campo de meta mensal
- ExpensePieChart (novo): PieChart com distribuição de gastos por categoria, legend top-8
- MonthlyChart: lado a lado com PieChart em desktop, empilhados em mobile
- Botão de export Excel no header (ícone Download)
- Validação Agent Browser:
  - Estrutura de grupos: Despesas(21) > Cartões BR(10) + Contas casa(11) ✓
  - Rendimentos(4) > Em Real(2) + Em Euro(1) + Valores a receber(1) ✓
  - Recorrência Salário: 7000 criado em Julho, propagou para Ago-Dez ✓
  - Recorrência Empréstimo 3x: 1/3 Jul, 2/3 Ago, 3/3 Set, vazio Out (auto-disable) ✓
  - Parar recorrência: aceitar dialog → remove Setembro, mantém Agosto ✓
  - Meta mensal: Supermercado meta=200, valor=240 → badge "meta" ✓
  - Renomeação: grupo Despesas → "Despesas totais" via API ✓
  - Export Excel: .xlsx gerado (33KB) ✓
  - Sync em tempo real: Luz Endesa 55 editado em uma sessão, apareceu na outra ✓

Stage Summary:
- 3 grupos top-level (Despesas, Rendimentos, Reservas) com subgrupos aninhados
- "Valores a receber" agora é subgrupo dentro de Rendimentos
- "Contas casa" agora é subgrupo dentro de Despesas
- SummaryCard mostra apenas "Saldo total" (R$ + € equivalente)
- Transações recorrentes com ou sem parcelas, auto-desligam no fim
- Botão "Parar recorrência" remove parcelas futuras
- Metas mensais com badge de alerta quando excedidas
- Gráfico de pizza de distribuição de gastos
- Gráfico de barras mantido lado a lado
- Export Excel funcional
- Renomeação de grupos, subgrupos e categorias
- Sync em tempo real mantido

---
Task ID: v4
Agent: super-z (main)
Task: Adicionar botão de copiar mês, botão de zerar valores, renomeação sempre visível, click em Entradas/Saídas para scroll, seletor de ano para visualização infinita.

Work Log:
- API /api/data atualizada para aceitar ?year=YYYY (filtra transações por ano)
- API /api/transactions/copy-month: copia todas as transações de (fromYear, fromMonth) para (toYear, toMonth), sobrescrevendo existentes
- API /api/transactions/reset: deleta transações por escopo ('month' ou 'year')
- API /api/export atualizada para aceitar ?year=YYYY
- Hook useFinanceData atualizado para aceitar year como segundo parâmetro; re-fetch quando year muda
- Hook trata bulk delete (deleteYear/deleteMonth) em ChangeMessage
- MonthSelector redesenhado: navegação de ano (← 2026 →) acima da faixa de meses
- CopyMonthDialog: escolher ano+mes destino, grid de 4x3 meses, mostra "origem" no mês atual, warning se igual
- ResetDialog: escopo mês/ano, warning, confirmação digitando "ZERAR"
- TopGroupCard: id={`group-${topGroupKey}`} para scroll; RenameButton sempre visível (removido opacity-0 group-hover:opacity-100)
- SummaryCard: Entradas e Saídas agora são botões clicáveis com onEntradasClick/onSaidasClick
  - Click Entradas → scroll suave para grupo 'rendimentos' + highlight ring
  - Click Saídas → scroll suave para grupo 'despesas' + highlight ring
- TransactionEditor: aceita prop `year`, usa em vez de hardcoded 2026
- page.tsx: year state, handlers handleCopyMonth/handleReset, scrollToGroup, botões Copy/Eraser no header
- Categorias e configurações são globais (não por ano); apenas transações são filtradas por ano

Stage Summary:
- Botão Copy (ícone) no header → dialog para copiar mês atual para qualquer outro mês/ano
- Botão Eraser (ícone) no header → dialog para zerar valores do mês ou ano inteiro (com confirmação ZERAR)
- Seletor de ano: setas ← → mudam o ano; dados persistem infinitamente, visualização é ano a ano
- Botão de renomear (lápis) agora sempre visível em grupos e subgrupos
- Click em Entradas/Saídas no resumo faz scroll suave para o grupo correspondente
- Sync em tempo real mantido entre dispositivos

---
Task ID: v5
Agent: super-z (main)
Task: Recorrência deve atravessar anos — finita (ex: 48x) continua em anos seguintes; infinita (sem parcelas) também.

Work Log:
- /api/transactions: substituída lógica que limitava ao dezembro do ano corrente
  - Finita (ex: 48x): cria exatamente N transações, calculando (year, month) com math cross-year
    - absoluteMonth = (month - 1) + i; targetMonth = (absoluteMonth % 12) + 1; targetYear = year + floor(absoluteMonth / 12)
  - Infinita (null): cria 120 meses (10 anos) como horizonte padrão
  - Activity log mostra range real: "Jul/2026 a Jun/2030 (48x)" ou "Jul/2026 a Jun/2036 (infinito)"
- /api/transactions/series-stop: deleta parcelas futuras considerando ano
  - OR clause: year > currentYear OR (year == currentYear AND month > currentMonth)
- TransactionEditor: 
  - Texto do label: "Nº de parcelas (deixe vazio para recorrência infinita)"
  - Placeholder: "Ex.: 48 (empréstimo 48x), 8, 12…"
  - Preview dinâmico mostra data final real:
    - Finita: "Criará 48 lançamentos de Julho/2026 até Junho/2030."
    - Infinita: "Recorrência infinita • criará lançamentos de Julho/2026 até Junho/2036 (10 anos)."
  - Badge de recorrência existente: "(infinito)" em vez de "(sem fim definido)"

Stage Summary:
- Recorrência finita 48x: testada de Jul/2026 (1/48) → Jan/2027 (7/48) → Dez/2027 (18/48) → Jun/2030 (48/48) → Jul/2030 (vazio, série terminou) ✓
- Recorrência infinita: testada em Jul/2026, Jul/2030, Jul/2035 — todas mostram "recorrente" ✓
- Parar recorrência cross-year: parada em 2030 removeu 71 parcelas futuras (2030-2036); 2026-2029 mantidos; 2031+ vazio ✓
- Lint limpo

---
Task ID: v6
Agent: super-z (main)
Task: Subgrupos dinâmicos com profundidade ilimitada — criar novos subgrupos dentro de despesas, rendimentos, etc., e sub-subgrupos dentro de subgrupos.

Work Log:
- Schema: criado model Subgroup { id, key, parentKey, name, sortOrder }
  - key é path completo: "despesas.contas_casa.mesada_breno.gastos_escolares"
  - Top-level e subgrupos padrão vêm de GROUP_STRUCTURE (não do DB); apenas subgrupos user-created são persistidos
- API /api/subgroups: POST (create com slugify do nome, valida parentKey), DELETE (remove subgrupo + descendentes, move categorias para parent)
- API /api/data: retorna array de subgroups
- finance.ts:
  - Tipo Subgroup adicionado
  - ChangeMessage: type 'subgroup' adicionado
  - getGroupLabel/getSubgroupLabel: aceitam userSubgroups[] como 3º param
  - Nova função buildGroupTree(): constrói árvore recursiva GroupTreeNode[] a partir de categories + subgroups + labels
  - Nova função computeNodeTotal(): soma valores de um nó + descendentes
  - Nova função collectGroupPaths(): coleta todos os paths para o seletor do CategoryEditor
  - buildNode recursivo: mostra user-created subgroups mesmo quando vazios (para que o usuário possa adicionar categorias)
- useFinanceData: subgroups no state, handler type 'subgroup' (create + delete com move-to-parent)
- Componente GroupNode (NOVO, substitui TopGroupCard): recursivo, renderiza qualquer profundidade
  - Cada nó tem: toggle collapse, label, rename (lápis), "novo subgrupo" (folder+), delete subgrupo (se user-created), total
  - Indentação visual por profundidade (marginLeft + border-left)
  - CategoryRow reutilizável em qualquer nível
- SubgroupEditor (NOVO): dialog simples com nome + label do parent
- CategoryEditor: seletor de grupo dinâmico via collectGroupPaths() — mostra "↳ Despesas › Mesada Breno › Gastos escolares" com indentação por depth
- actions.ts: createSubgroup(), deleteSubgroup()
- page.tsx: 
  - Usa buildGroupTree() para construir árvore filtrada por busca
  - Handlers handleCreateSubgroup, handleDeleteSubgroup (com collectDescendantKeys)
  - SubgroupEditor integrado

Stage Summary:
- Testado: criado subgrupo "Mesada Breno" dentro de Contas casa (depth 2)
- Testado: criado sub-subgrupo "Gastos escolares" dentro de Mesada Breno (depth 3)
- Testado: criado categoria "Material escolar" dentro de Gastos escolares
- Seletor de grupo no CategoryEditor mostra hierarquia completa: "↳ Despesas › Mesada Breno › Gastos escolares"
- Sync em tempo real: segunda sessão viu todos os subgrupos e categorias criados
- Botão "Novo subgrupo" (folder+) visível em todos os níveis
- Botão "Remover subgrupo" (trash) só em subgrupos user-created
- Renomeação via lápis funciona em qualquer nível
- Lint limpo

---
Task ID: v7
Agent: super-z (main)
Task: Categorias podem ter sub-categorias (árvore) com chevron e indentação travessão.

Work Log:
- Schema: adicionado parentCategoryId String? + relação CategoryTree (parent/children) em Category
- API /api/categories: POST aceita parentCategoryId
- finance.ts: 
  - Tipo Category atualizado com parentCategoryId
  - Nova função buildCategoryTree(categories, parentId): constrói árvore recursiva
  - Nova função computeCategoryNodeTotal(): soma valor próprio + descendentes
- GroupNode reescrito:
  - CategoryRow → CategoryNodeRow (recursivo)
  - Cada categoria com filhos mostra chevron (ChevronRight/ChevronDown)
  - Clique no chevron expande/recolhe os filhos
  - Filhos aparecem com indentação + border-left (travessão visual): ml-4 + border-l-2 + bg-muted/10
  - Cada categoria tem botão "+" (add sub-item) visível em hover
  - Total da categoria pai inclui filhos, com indicador "(com sub)" quando tem valor próprio + filhos
  - Badge (N) mostrando número de filhos diretos
- actions.ts: SaveCategoryArgs inclui parentCategoryId
- page.tsx: 
  - Estado newCatParent (parentCategoryId)
  - onAddCategory agora recebe (group, parentCategoryId)
  - handleCreateCategory passa parentCategoryId para a API
  - Botão "Nova categoria" do footer reset newCatParent para null

Stage Summary:
- Testado: Lazer › Comercio do Farazi › Coca Cola lata (3 níveis de categorias)
- Chevron aparece em categorias que têm filhos
- Indentação travessão: filhos aparecem com border-left + bg-muted/10 + margem
- Totais acumulam: Coca Cola R$5,50 → Comercio do Farazi R$5,50 → Lazer R$1.505,50 (com sub)
- Indicador "(com sub)" quando categoria tem valor próprio + filhos
- Botão "+" em hover para adicionar sub-item em qualquer categoria
- Lint limpo

---
Task ID: v8
Agent: super-z (main)
Task: Saldo do mês anterior carrega para o próximo mês como linha destacada no topo de Despesas (déficit) ou Rendimentos (sobra).

Work Log:
- API /api/previous-month-balance?year=YYYY&month=M: calcula saldo realizado do mês anterior
  - balance = entradas - saídas (BRL, EUR convertido a euroRate)
  - Exclui categorias excludeFromTotal (receivables)
  - Trata跨-year: se month=1, busca dezembro do ano anterior
  - Retorna { balance, currency, prevMonth, prevYear, prevMonthLabel }
- page.tsx: 
  - Estado prevMonthBalance + prevMonthLabel
  - useEffect busca /api/previous-month-balance quando month ou year muda
  - Passa previousMonthBalance + prevMonthLabel + onPrevMonthClick para GroupNode
  - onPrevMonthClick: navega para mês anterior (tratando跨-year)
- GroupNode:
  - Novas props: previousMonthBalance, prevMonthLabel, onPrevMonthClick
  - showPrevBalance: true se top-level Despesas E balance < 0, OU top-level Rendimentos E balance > 0
  - displayTotal inclui |balance| quando showPrevBalance
  - Renderiza PrevBalanceRow no topo do corpo, antes de categorias e subgrupos
- PrevBalanceRow (novo componente):
  - Fundo gradient amber (from-amber-50 to-amber-50/30)
  - Borda lateral esquerda amber 4px (border-l-4 border-l-amber-400)
  - Ícone circular amber com ArrowLeftRight
  - "Saldo mês anterior" + badge com mês/ano (ex: "Jun/2026")
  - Subtítulo "déficit do mês anterior" ou "sobra do mês anterior"
  - Valor em vermelho (déficit) ou verde (sobra) com dupla moeda
  - Click navega para o mês anterior

Stage Summary:
- Testado em Julho: mostra "Saldo mês anterior | Jun/2026 | déficit do mês anterior | −R$ 1.500,00 | ≈ € 250,00"
- Testado em Agosto: mostra "Saldo mês anterior | Jul/2026 | déficit do mês anterior | −R$ 4.506,50"
- Linha aparece no topo de Despesas, antes de Cartões BR
- Total de Despesas inclui o saldo anterior (Julho: R$ 15.189,50 com déficit)
- Saldo total do mês inclui o saldo anterior no cálculo
- Click na linha navega para o mês anterior
- Lint limpo

---
Task ID: v16
Agent: super-z (main)
Task: Backup JSON (export/import); notificações push para vencimentos; orçamento anual com meta de poupança.

Work Log:
1. Backup JSON:
   - API GET /api/backup: retorna JSON completo (categories, subgroups, transactions, notes, config, activityLogs)
   - API POST /api/backup/import: aceita { backup, mode: 'replace' | 'merge' }
     - replace: apaga tudo e restaura do backup
     - merge: adiciona só o que falta (por ID)
   - BackupDialog: exportar (download JSON), importar (file picker + mode selector)
   - Botão Database no header

2. Notificações push:
   - Hook useVencimentoNotifications: parse "vence dia X", notifica 3 dias antes, 1 dia antes, e no dia
   - Uses Notification API (nativo do browser), pede permissão
   - Não repete notificação no mesmo dia (localStorage key)
   - Botão Bell/BellOff no header

3. Orçamento anual:
   - API GET/POST /api/budget: armazena meta em config key `budget:YYYY`
   - BudgetCard: mostra Poupado / Meta / Faltam, progress bar colorida, status
   - Editável via Popover (lápis)
   - Calcula poupança atual = entradas - saídas do ano todo

Stage Summary:
- Backup: exportar JSON completo, importar com modo replace ou merge
- Notificações: ativa/desativa via botão Bell, notifica vencimentos 3/1/0 dias antes
- Orçamento: meta de poupança anual com progress bar e status visual
- Todos os componentes perdidos foram recriados (undo-redo-buttons, vencimento-alerts, annual-dashboard, move-category-dialog, theme-toggle, theme-provider, notes-panel, use-action-history)
- Lint limpo

---
Task ID: v17
Agent: super-z (main)
Task: 3 correções: refazer não funciona ("not found"), exclusão de subgrupo com opção mover/excluir tudo, drag-and-drop de categorias (sem setas).

Work Log:
1. Corrigir bug do refazer ("not found"):
   - Causa raiz: ao desfazer a deleção de uma categoria, ela é recriada com NOVO ID no banco. Mas a função redo ainda referenciava o ID ANTIGO. A API retornava 404 "not found".
   - Padrão aplicado: usar um objeto mutável `idRef = { current: id }` capturado no closure. Undo atualiza `idRef.current = novo_id` após recriar. Redo usa `idRef.current` para deletar.
   - Aplicado em 4 lugares:
     - `handleDeleteCategory` (undo recria, redo deleta pelo idRef)
     - `handleCreateCategory` (undo deleta pelo idRef, redo recria e atualiza idRef)
     - `handleCreateSubgroup` (mesmo padrão com keyRef)
     - `handleSaveTransaction` (mesmo padrão com txIdsRef)
   - Testado: 3 ciclos undo→redo sem erro.

2. Exclusão de subgrupo com opção mover OU excluir tudo:
   - API `/api/subgroups` DELETE atualizada para aceitar `mode: 'move' | 'delete'`:
     - mode=move (default): move categorias para o grupo pai (comportamento antigo)
     - mode=delete: deleta categorias + transações junto com o subgrupo
   - Retorna `deletedCategoryIds` quando mode=delete para sincronização
   - `deleteSubgroup()` action atualizada com parâmetro mode
   - Novo componente `DeleteSubgroupDialog` com dois botões grandes:
     - "Mover para o grupo pai" (azul, ícone FolderInput)
     - "Excluir tudo" (vermelho, ícone Trash2)
   - `handleDeleteSubgroup` agora apenas abre o dialog; `handleDeleteSubgroupConfirm(mode)` faz o trabalho
   - Hook `useFinanceData` atualizado para tratar `mode: 'delete'` em ChangeMessage:
     - Remove categorias (e suas transações) quando mode=delete
     - Mantém comportamento de mover quando mode=move
   - Testado: mode=move (categorias aparecem no grupo pai), mode=delete (categorias somem junto com subgrupo)

3. Drag-and-drop de categorias (sem setas):
   - Removidos botões ArrowUp/ArrowDown das categorias (mantidos apenas nos top-level cards)
   - Criado singleton store `category-dnd.ts` com `useSyncExternalStore` para estado global de drag
   - Implementação com pointer events (funciona em mouse e touch):
     - On pointerdown: registra posição inicial (não inicia drag ainda)
     - On pointermove > 5px threshold: entra em modo drag (evita conflito com click)
     - Durante drag: ghost element segue o ponteiro (portal no body, com rotação/sombra)
     - Detecção de drop target via `document.elementFromPoint()` + `closest('[data-cat-id]')`
     - Indicador visual: linha azul acima (before) ou abaixo (after) do target
     - On pointerup: chama `onDropCategory(draggedId, targetId, position)`
     - `touch-action: none` no row previne scroll durante drag
     - `document.body.style.overflow='hidden'` durante drag
   - Cada row tem `data-cat-id` para hit-testing
   - GripVertical icon como pista visual de área arrastável
   - Handler `onDropCategory` em page.tsx:
     - Calcula nova ordem dos siblings (incluindo cross-parent move)
     - Se mudou grupo/pai: updateCategory primeiro (muda group + parentCategoryId)
     - reorderCategories com nova sortOrder (i+1)
     - dispatchChange + reload para sincronizar
   - Suporta drag dentro do mesmo pai E cross-parent (drag categoria de um subgrupo para outro)
   - Testado: SORT TEST movido abaixo de API TEST 2 com sucesso

Stage Summary:
- Refazer funciona em múltiplos ciclos (undo→redo→undo→redo) sem erro "not found"
- Dialog de exclusão de subgrupo pergunta: "Mover para o grupo pai" ou "Excluir tudo"
- Drag-and-drop com pointer events (mouse + touch), ghost visual, indicadores de drop
- Setas removidas das categorias (mantidas apenas nos top-level cards)
- Lint limpo, dev server compilando sem erros

---
Task ID: v18
Agent: super-z (main)
Task: Drag-and-drop para subgrupos e top-level cards; evitar reload da página; garantir undo/redo em todas as ações (incluindo deleção de subgrupo).

Work Log:
1. Estendido DnD store (category-dnd.ts) para suportar 3 tipos: 'category', 'subgroup', 'topgroup'
   - Adicionado campo `type` ao estado
   - Atributos data-cat-id, data-sg-key, data-tg-key para hit-testing
   - ATTR_BY_TYPE mapeia tipo → nome do atributo

2. Criada API /api/subgroups/reorder (POST) — aceita items [{id, sortOrder}]
   - Mesmo padrão de /api/categories/reorder e /api/topgroups/reorder
   - Adicionada action reorderSubgroups() em actions.ts

3. Drag-and-drop em headers de subgrupos e top-level cards (gn6.tsx):
   - handleHeaderPointerDown: pointer events no header div
   - Detecta cliques em botões de ação (aria-label) e ignora (não inicia drag)
   - O botão expand/colapsar (sem aria-label) É área de drag
   - cardEl = rowEl.closest('[class*="overflow-hidden"]') — encontra o Card inteiro
   - Durante drag: cardEl.style.pointerEvents = 'none' — elementFromPoint vê ATRAVÉS do card
   - Drop indicators (linha azul) no topo (before) ou bottom (after) do header
   - GripVertical icon como pista visual em todos os headers
   - Removidos botões ArrowUp/ArrowDown dos top-level cards (substituídos por drag)

4. Handlers em page.tsx:
   - onDropSubgroup: reordena subgrupos dentro do mesmo parentKey
     - Se parentKey diferente: toast.error (não permite cross-parent)
     - reorderSubgroups + dispatch local + history.push (undo/redo)
   - onDropTopGroup: reordena top-level cards
     - Bug corrigido: targetIdx era calculado do array original, mas inserção usava array filtrado
     - Nova lógica: filter → findIndex in filtered → splice → map
     - reorderTopGroups + reload + history.push (undo/redo)
   - onDropCategory: atualizado para NÃO fazer reload completo
     - Dispatcha eventos 'category' update para cada categoria afetada
     - history.push com undo/redo completo

5. Undo/redo para deleção de subgrupo (handleDeleteSubgroupConfirm):
   - Snapshot antes de deletar: subgroups + categories + transactions
   - Undo (mode='delete'): recria subgroups com key original, recria categories com id original, recria transactions
   - Undo (mode='move'): recria subgroups com key original, move categories de volta
   - Redo: chama deleteSubgroup novamente
   - API /api/subgroups POST aceita `key` e `sortOrder` explícitos (para restore)
   - API /api/categories POST aceita `id` explícito (para restore)

6. Hook use-finance-data atualizado:
   - case 'subgroup' action 'update': agora atualiza subgroup existente (merge {...x, ...sg})
   - Antes só tratava create e delete

7. Bug crítico corrigido em gn6.tsx:
   - handleUp referenciava `allProps` (não definido no escopo do GroupNode)
   - Corrigido para usar `props` (que é o parâmetro do componente)
   - Este bug causava ReferenceError silencioso que impedia o drop de funcionar

Stage Summary:
- Drag-and-drop funciona para: categorias, subgrupos, e top-level cards
- Sem setas — tudo via arrastar com pointer events (mouse + touch)
- Ghost visual segue o ponteiro; linha azul indica posição de drop
- Não há reload completo da página ao reordenar categorias (atualização local)
- Top-level cards ainda precisam de reload (topGroups são tratados via config)
- Undo/redo funciona para: criar/deletar categoria, criar/deletar subgrupo (ambos modos), reordenar categoria, reordenar subgrupo, reordenar card, salvar transação, copiar mês, zerar valores
- Lint limpo, sem erros no browser
- Testado via agent-browser:
  - Drag de categoria: Santander Kiki movida de posição ✓
  - Drag de subgrupo: Cartões BR movido para depois de Contas casa ✓
  - Drag de top-level card: Despesas movida para depois de Reservas ✓
  - Undo de delete categoria: Santander Kiki restaurada ✓
  - Undo de delete subgrupo (mode=delete): subgrupo + categoria restaurados ✓

---
Task ID: v19
Agent: super-z (main)
Task: Reorganizar header do mobile — remover ícone Exportar Excel, colocar nome do projeto acima dos ícones (escrito corrido).

Work Log:
- Header reestruturado em 2 linhas (era 1 linha com nome + ícones lado a lado):
  - Linha 1: ícone € + "Porto 2026 • Controle financeiro • 2026" + badge Online/Offline (full width, escrito corrido)
  - Linha 2: todos os ícones de ação (flex-wrap para caber em qualquer tela)
- Removido botão "Exportar Excel" do header (era 1 ícone a mais apertando o mobile)
- Função handleExportExcel mantida e agora acessível via Configurações → "Exportar planilha"
- SettingsDialog atualizado com nova seção "Exportar planilha" (botão outline com ícone Download)
- Badge de sync: "Sincronizando" em desktop, "Online" em mobile (economiza espaço)
- Import Download removido de page.tsx (não usado mais), adicionado em settings-dialog.tsx

Stage Summary:
- Header mobile muito mais limpo: nome do projeto legível em linha única acima dos ícones
- Ícones de ação ocupam linha própria e quebram naturalmente (flex-wrap)
- Exportar Excel não sumiu — movido para Configurações
- Lint limpo
