// Shared types for the finance app.

export type CategoryType = 'EXPENSE' | 'INCOME' | 'RESERVE'
export type Currency = 'BRL' | 'EUR'
export type CategoryGroup =
  | 'despesas'
  | 'contas_casa'
  | 'rendimentos_brl'
  | 'rendimentos_eur'
  | 'reservas'
  | 'valores_a_receber'

export interface Category {
  id: string
  name: string
  group: CategoryGroup
  type: CategoryType
  currency: Currency
  note: string | null
  sortOrder: number
  autoConvert: boolean
  excludeFromTotal: boolean
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
  type: 'transaction' | 'category' | 'config' | 'activity'
  action: 'create' | 'update' | 'delete'
  payload: any
  by: { name: string; color: string } | null
  at: number
  detail?: string
}

// Group labels in PT-BR
export const GROUP_LABELS: Record<CategoryGroup, string> = {
  despesas: 'Despesas (BR)',
  contas_casa: 'Contas casa (PT)',
  rendimentos_brl: 'Rendimentos BRL',
  rendimentos_eur: 'Rendimentos EUR',
  reservas: 'Reservas',
  valores_a_receber: 'Valores a receber',
}

export const GROUP_ORDER: CategoryGroup[] = [
  'despesas',
  'contas_casa',
  'rendimentos_brl',
  'rendimentos_eur',
  'reservas',
  'valores_a_receber',
]

export const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export const MONTHS_PT_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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

// Format a value showing BOTH currencies. Example output for BRL 60 with
// euroRate=6:  "R$ 60,00 (€ 10,00)"
//               "€ 10,00 (R$ 60,00)" for an EUR value.
// The "primary" currency decides which side goes first.
export function formatDual(v: number, primary: Currency, euroRate: number): string {
  if (primary === 'BRL') {
    const eur = v / euroRate
    return `${formatBRL(v)} (${formatEUR(eur)})`
  }
  const brl = v * euroRate
  return `${formatEUR(v)} (${formatBRL(brl)})`
}

// Compact version for tight UI spaces (e.g. chart axis, totals in cards):
// "R$ 60 (€ 10)" — no decimal places when value is integer-ish.
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
