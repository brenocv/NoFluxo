// Shared types for the finance app.

export type CategoryType = 'EXPENSE' | 'INCOME' | 'RESERVE'
export type Currency = 'BRL' | 'EUR'
export type CategoryGroup =
  | 'despesas'
  | 'contas_casa'
  | 'rendimentos_brl'
  | 'rendimentos_eur'
  | 'reservas'

export interface Category {
  id: string
  name: string
  group: CategoryGroup
  type: CategoryType
  currency: Currency
  note: string | null
  sortOrder: number
  autoConvert: boolean
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
}

export const GROUP_ORDER: CategoryGroup[] = [
  'despesas',
  'contas_casa',
  'rendimentos_brl',
  'rendimentos_eur',
  'reservas',
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
