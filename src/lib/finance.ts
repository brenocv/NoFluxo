// Shared types for the finance app.

export type CategoryType = 'EXPENSE' | 'INCOME' | 'RESERVE'
export type Currency = 'BRL' | 'EUR'

// Group is now a hierarchical string:
//   "despesas"                     -> top-level "Despesas"
//   "despesas.cartoes"             -> subgroup inside Despesas
//   "despesas.contas_casa"         -> subgroup inside Despesas
//   "rendimentos"                  -> top-level "Rendimentos"
//   "rendimentos.brl"              -> subgroup inside Rendimentos
//   "rendimentos.eur"              -> subgroup inside Rendimentos
//   "rendimentos.valores_a_receber"-> subgroup inside Rendimentos
//   "reservas"                     -> top-level "Reservas"
export type Group = string
// Alias kept for backwards compatibility — many components still import CategoryGroup.
export type CategoryGroup = string

export interface Category {
  id: string
  name: string
  group: Group
  type: CategoryType
  currency: Currency
  note: string | null
  sortOrder: number
  autoConvert: boolean
  excludeFromTotal: boolean
  monthlyGoal: number | null
  color: string | null
  parentCategoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  categoryId: string
  year: number
  month: number
  value: number
  note: string | null
  isRecurring: boolean
  seriesId: string | null
  installmentNumber: number | null
  installmentsTotal: number | null
  createdAt: string
  updatedAt: string
}

export interface ActivityEntry {
  id: string
  user: string
  action: string
  entity: string
  detail: string
  createdAt: string
}

export interface Subgroup {
  id: string
  key: string
  parentKey: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TopGroup {
  id: string
  workbookId: string
  key: string
  name: string
  color: string
  sortOrder: number
  type: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface PresenceUser {
  id: string
  name: string
  color: string
  connectedAt: number
}

export interface ChangeMessage {
  type: 'transaction' | 'category' | 'config' | 'activity' | 'label' | 'subgroup'
  action: 'create' | 'update' | 'delete'
  payload: any
  by: { name: string; color: string } | null
  at: number
  detail?: string
}

// ---- Group structure ----

export interface GroupDef {
  key: string
  label: string
  subgroups: { key: string; label: string }[]
}

// Top-level groups and their default subgroups.
export const GROUP_STRUCTURE: GroupDef[] = [
  {
    key: 'despesas',
    label: 'Despesas',
    subgroups: [
      { key: 'despesas.cartoes', label: 'Cartões BR' },
      { key: 'despesas.contas_casa', label: 'Contas casa' },
    ],
  },
  {
    key: 'rendimentos',
    label: 'Rendimentos',
    subgroups: [
      { key: 'rendimentos.brl', label: 'Em Real (R$)' },
      { key: 'rendimentos.eur', label: 'Em Euro (€)' },
      { key: 'rendimentos.valores_a_receber', label: 'Valores a receber' },
    ],
  },
  {
    key: 'reservas',
    label: 'Reservas',
    subgroups: [],
  },
]

// Order of top-level groups for rendering.
export const TOP_GROUP_ORDER = ['despesas', 'rendimentos', 'reservas']

// Get the top-level group key from a full group string.
export function getTopGroup(group: string): string {
  const idx = group.indexOf('.')
  return idx === -1 ? group : group.substring(0, idx)
}

// Get the subgroup key from a full group string (or null if top-level).
export function getSubgroup(group: string): string | null {
  const idx = group.indexOf('.')
  return idx === -1 ? null : group
}

// Default label for a top-level group.
export function defaultTopGroupLabel(topKey: string): string {
  const g = GROUP_STRUCTURE.find((g) => g.key === topKey)
  return g?.label ?? topKey
}

// Default label for a subgroup: check default subgroups first, then user-created.
export function defaultSubgroupLabel(subKey: string, userSubgroups: Subgroup[] = []): string {
  for (const g of GROUP_STRUCTURE) {
    const sg = g.subgroups.find((s) => s.key === subKey)
    if (sg) return sg.label
  }
  const user = userSubgroups.find((s) => s.key === subKey)
  return user?.name ?? subKey.split('.').pop() ?? subKey
}

// Get the label for a group (top or sub, any depth) from the labels map.
export function getGroupLabel(
  group: string,
  labels: Record<string, string>,
  userSubgroups: Subgroup[] = []
): string {
  if (group.includes('.')) {
    return labels[`subgroup:${group}`] ?? defaultSubgroupLabel(group, userSubgroups)
  }
  return labels[`group:${group}`] ?? defaultTopGroupLabel(group)
}

// Get the top-level group label.
export function getTopGroupLabel(
  topKey: string,
  labels: Record<string, string>
): string {
  return labels[`group:${topKey}`] ?? defaultTopGroupLabel(topKey)
}

// ---- Recursive group tree ----

export interface GroupTreeNode {
  key: string
  label: string
  depth: number
  isTopLevel: boolean
  isUserCreated: boolean
  isReceivable: boolean
  color: string | null  // hex color from TopGroup, or null to use defaults
  isDefaultTop: boolean // true for default top-level groups (can't delete)
  groupType: string     // "EXPENSE" | "INCOME" | "RESERVE" (from TopGroup)
  children: GroupTreeNode[]
  categories: Category[]
}

// Build a recursive group tree from categories + subgroups + topGroups.
export function buildGroupTree(
  categories: Category[],
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  topGroups: TopGroup[],
  filterCategoryIds?: Set<string>
): GroupTreeNode[] {
  const nodes: GroupTreeNode[] = []

  for (const tg of topGroups) {
    const topLabel = labels[`group:${tg.key}`] ?? tg.name
    const node = buildNode(
      tg.key, topLabel, 0, true, false,
      categories, userSubgroups, labels, filterCategoryIds,
      tg.color, tg.isDefault, tg.type
    )
    nodes.push(node)
  }

  return nodes
}

function buildNode(
  key: string,
  label: string,
  depth: number,
  isTopLevel: boolean,
  isUserCreated: boolean,
  categories: Category[],
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  filterCategoryIds?: Set<string>,
  color?: string | null,
  isDefaultTop?: boolean,
  groupType?: string
): GroupTreeNode {
  const directCategories = categories.filter((c) => {
    if (c.group !== key) return false
    if (filterCategoryIds && !filterCategoryIds.has(c.id)) return false
    return true
  })

  // All subgroups come from the DB now (default + user-created)
  const childKeys = userSubgroups
    .filter((s) => s.parentKey === key)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ key: s.key, label: s.name, isUserCreated: true }))

  const children = childKeys.map((ck) => {
    const childLabel = getGroupLabel(ck.key, labels, userSubgroups)
    return buildNode(
      ck.key, childLabel, depth + 1, false, ck.isUserCreated,
      categories, userSubgroups, labels, filterCategoryIds,
      color, false, groupType
    )
  }).filter((n) => {
    if (countCategoriesRecursive(n) > 0) return true
    if (n.children.length > 0) return true
    if (n.isUserCreated) return true
    return false
  })

  const isReceivable = key === 'rendimentos.valores_a_receber'

  return {
    key, label, depth, isTopLevel, isUserCreated, isReceivable,
    color: color ?? null,
    isDefaultTop: isDefaultTop ?? false,
    groupType: groupType ?? 'EXPENSE',
    children, categories: directCategories,
  }
}

function countCategoriesRecursive(node: GroupTreeNode): number {
  let count = node.categories.length
  for (const child of node.children) {
    count += countCategoriesRecursive(child)
  }
  return count
}

// Compute the total value of a node (including all descendants) for a given month.
export function computeNodeTotal(
  node: GroupTreeNode,
  transactionsByCat: Record<string, Transaction | undefined>,
  euroRate: number
): number {
  let total = 0
  for (const cat of node.categories) {
    const tx = transactionsByCat[cat.id]
    if (!tx) continue
    if (cat.currency === 'EUR') total += tx.value * euroRate
    else total += tx.value
  }
  for (const child of node.children) {
    total += computeNodeTotal(child, transactionsByCat, euroRate)
  }
  return total
}

// Collect all group keys in the tree (for the category editor's group selector).
export function collectGroupPaths(
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  topGroups?: TopGroup[]
): { value: string; label: string; depth: number }[] {
  const result: { value: string; label: string; depth: number }[] = []
  const groups = topGroups ?? []
  for (const tg of groups) {
    const topLabel = labels[`group:${tg.key}`] ?? tg.name
    result.push({ value: tg.key, label: topLabel, depth: 0 })
    // All subgroups (default + user-created) come from DB
    const children = userSubgroups.filter((s) => s.parentKey === tg.key).sort((a, b) => a.sortOrder - b.sortOrder)
    for (const uc of children) {
      const ucLabel = getGroupLabel(uc.key, labels, userSubgroups)
      result.push({ value: uc.key, label: `${topLabel} › ${ucLabel}`, depth: 1 })
      collectUserSubgroups(uc.key, topLabel, ucLabel, userSubgroups, labels, 1, result)
    }
  }
  return result
}

function collectUserSubgroups(
  parentKey: string,
  parentPathLabel: string,
  parentLabel: string,
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  depth: number,
  result: { value: string; label: string; depth: number }[]
) {
  const children = userSubgroups
    .filter((s) => s.parentKey === parentKey)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const child of children) {
    const childLabel = getGroupLabel(child.key, labels, userSubgroups)
    const pathLabel = `${parentPathLabel} › ${childLabel}`
    result.push({ value: child.key, label: pathLabel, depth: depth + 1 })
    collectUserSubgroups(child.key, parentPathLabel + ' › ' + childLabel, childLabel, userSubgroups, labels, depth + 1, result)
  }
}

// Like collectGroupPaths, but also includes categories (sub-items) as selectable options.
// Categories are identified by value "cat:<categoryId>". This allows the Quick Add dialog
// to let the user add a value to any existing category at any depth.
export function collectAllPaths(
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  topGroups: TopGroup[],
  categories: Category[]
): { value: string; label: string; depth: number }[] {
  const result: { value: string; label: string; depth: number }[] = []
  const groups = topGroups
  for (const tg of groups) {
    const topLabel = labels[`group:${tg.key}`] ?? tg.name
    result.push({ value: tg.key, label: topLabel, depth: 0 })
    collectAllChildren(tg.key, topLabel, topLabel, userSubgroups, labels, categories, 0, result)
  }
  return result
}

function collectAllChildren(
  parentKey: string,
  parentPathLabel: string,
  parentLabel: string,
  userSubgroups: Subgroup[],
  labels: Record<string, string>,
  categories: Category[],
  depth: number,
  result: { value: string; label: string; depth: number }[]
) {
  // Subgroups under this parent
  const childSgs = userSubgroups
    .filter((s) => s.parentKey === parentKey)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const child of childSgs) {
    const childLabel = getGroupLabel(child.key, labels, userSubgroups)
    const pathLabel = `${parentPathLabel} › ${childLabel}`
    result.push({ value: child.key, label: pathLabel, depth: depth + 1 })
    collectAllChildren(child.key, pathLabel, childLabel, userSubgroups, labels, categories, depth + 1, result)
  }
  // Categories directly in this group (no parent category)
  const directCats = categories
    .filter((c) => c.group === parentKey && !c.parentCategoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const cat of directCats) {
    const pathLabel = `${parentPathLabel} › ${cat.name}`
    result.push({ value: `cat:${cat.id}`, label: pathLabel, depth: depth + 1 })
    // Recurse into sub-categories
    collectCategoryChildren(cat.id, pathLabel, categories, depth + 1, result)
  }
}

function collectCategoryChildren(
  parentCatId: string,
  parentPathLabel: string,
  categories: Category[],
  depth: number,
  result: { value: string; label: string; depth: number }[]
) {
  const children = categories
    .filter((c) => c.parentCategoryId === parentCatId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const child of children) {
    const pathLabel = `${parentPathLabel} › ${child.name}`
    result.push({ value: `cat:${child.id}`, label: pathLabel, depth: depth + 1 })
    collectCategoryChildren(child.id, pathLabel, categories, depth + 1, result)
  }
}

// ---- Category tree (nested categories) ----

export interface CategoryNode {
  category: Category
  children: CategoryNode[]
  depth: number
}

// Build a tree of categories from a flat list. Only categories whose
// parentCategoryId is null (or whose parent is not in the list) are roots.
// `parentId` filters to only children of the given parent (null = roots).
export function buildCategoryTree(
  categories: Category[],
  parentId: string | null = null
): CategoryNode[] {
  const children = categories
    .filter((c) => (c.parentCategoryId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return children.map((c) => ({
    category: c,
    children: buildCategoryTree(categories, c.id),
    depth: 0, // depth is set by the renderer
  }))
}

// Compute the total value of a category node (own value + all descendants).
export function computeCategoryNodeTotal(
  node: CategoryNode,
  transactionsByCat: Record<string, Transaction | undefined>,
  euroRate: number
): number {
  let total = 0
  const tx = transactionsByCat[node.category.id]
  if (tx) {
    total += node.category.currency === 'EUR' ? tx.value * euroRate : tx.value
  }
  for (const child of node.children) {
    total += computeCategoryNodeTotal(child, transactionsByCat, euroRate)
  }
  return total
}

// ---- Months ----

export const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export const MONTHS_PT_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ---- Formatting ----

export function formatMoney(v: number, currency: Currency) {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (currency === 'BRL') {
    return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${sign}€ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatBRL(v: number) {
  const sign = v < 0 ? '-' : ''
  return `${sign}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatEUR(v: number) {
  const sign = v < 0 ? '-' : ''
  return `${sign}€ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Format a value showing BOTH currencies.
export function formatDual(v: number, primary: Currency, euroRate: number): string {
  if (primary === 'BRL') {
    return `${formatBRL(v)} (${formatEUR(v / euroRate)})`
  }
  return `${formatEUR(v)} (${formatBRL(v * euroRate)})`
}

// Compact dual format: "R$ 60 (€ 10)"
export function formatDualCompact(v: number, primary: Currency, euroRate: number): string {
  const f = (n: number, cur: Currency) => {
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    const symbol = cur === 'BRL' ? 'R$' : '€'
    const hasDecimals = Math.abs(abs - Math.round(abs)) > 0.001
    const formatted = hasDecimals
      ? abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    return `${sign}${symbol} ${formatted}`
  }
  if (primary === 'BRL') {
    return `${f(v, 'BRL')} (${f(v / euroRate, 'EUR')})`
  }
  return `${f(v, 'EUR')} (${f(v * euroRate, 'BRL')})`
}
