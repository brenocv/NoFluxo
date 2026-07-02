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

export interface PresenceUser {
  id: string
  name: string
  color: string
  connectedAt: number
}

export interface ChangeMessage {
  type: 'transaction' | 'category' | 'config' | 'activity' | 'label'
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

// Top-level groups and their subgroups (default labels).
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

// Default label for a subgroup.
export function defaultSubgroupLabel(subKey: string): string {
  for (const g of GROUP_STRUCTURE) {
    const sg = g.subgroups.find((s) => s.key === subKey)
    if (sg) return sg.label
  }
  return subKey
}

// Get the label for a group (top or sub) from the labels map.
export function getGroupLabel(
  group: string,
  labels: Record<string, string>
): string {
  // If it's a subgroup, check "subgroup:<key>" first
  if (group.includes('.')) {
    return labels[`subgroup:${group}`] ?? defaultSubgroupLabel(group)
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
