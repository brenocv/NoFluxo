'use client'

// Thin wrapper around the API calls.
import { Category, Currency } from '@/lib/finance'

export interface SaveTransactionArgs {
  categoryId: string
  month: number
  year?: number
  value: number | null
  note?: string | null
  user: string
  isRecurring?: boolean
  installmentsTotal?: number | null
}

export interface SaveTransactionResult {
  ok: boolean
  action: 'create' | 'update' | 'delete' | 'noop'
  transactions: any[]  // for recurring, multiple; for single, [transaction]
  transaction: any     // the primary transaction (first or only)
  category: Category
}

export async function saveTransaction(args: SaveTransactionArgs): Promise<SaveTransactionResult> {
  const r = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao salvar')
  }
  const data = await r.json()
  // Normalise: if transactions array exists, use first as primary
  if (data.transactions && data.transactions.length > 0) {
    return { ...data, transaction: data.transactions[0] }
  }
  return data
}

export async function stopRecurringSeries(
  seriesId: string,
  currentMonth: number,
  currentYear: number,
  user: string
): Promise<{ ok: boolean; deletedCount: number; category: Category | null }> {
  const r = await fetch('/api/transactions/series-stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesId, currentMonth, currentYear, user }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao parar recorrência')
  }
  return r.json()
}

export async function copyMonth(args: {
  fromYear: number
  fromMonth: number
  toYear: number
  toMonth: number
  user: string
}): Promise<{
  ok: boolean
  createdCount: number
  updatedCount: number
  total: number
  transactions: any[]
}> {
  const r = await fetch('/api/transactions/copy-month', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao copiar mês')
  }
  return r.json()
}

export async function resetValues(args: {
  scope: 'month' | 'year'
  year: number
  month?: number
  user: string
}): Promise<{ ok: boolean; deletedCount: number }> {
  const r = await fetch('/api/transactions/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao zerar valores')
  }
  return r.json()
}

export interface SaveCategoryArgs {
  name: string
  group: string
  type: 'EXPENSE' | 'INCOME' | 'RESERVE'
  currency: Currency
  note?: string
  excludeFromTotal?: boolean
  monthlyGoal?: number | null
  color?: string | null
  parentCategoryId?: string | null
  workbookId?: string
  user: string
}

export async function createCategory(args: SaveCategoryArgs): Promise<{ ok: boolean; category: Category }> {
  const r = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao criar categoria')
  }
  return r.json()
}

export async function updateCategory(
  id: string,
  fields: {
    name?: string
    note?: string | null
    monthlyGoal?: number | null
    excludeFromTotal?: boolean
    currency?: 'BRL' | 'EUR'
    color?: string | null
    group?: string
    parentCategoryId?: string | null
  },
  user: string
): Promise<{ ok: boolean; category: Category }> {
  const r = await fetch('/api/categories', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...fields, user }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao atualizar categoria')
  }
  return r.json()
}

export async function deleteCategory(id: string, user: string): Promise<{ ok: boolean }> {
  const r = await fetch('/api/categories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, user }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao remover categoria')
  }
  return r.json()
}

export async function updateConfig(key: string, value: string, user: string): Promise<{ ok: boolean; config: any }> {
  const r = await fetch('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, user }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao atualizar config')
  }
  return r.json()
}

export async function updateLabel(key: string, value: string, user: string, workbookId?: string): Promise<{ ok: boolean; labels: Record<string, string> }> {
  const r = await fetch('/api/labels', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, user, workbookId }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao atualizar rótulo')
  }
  return r.json()
}

export async function createSubgroup(
  parentKey: string,
  name: string,
  user: string,
  workbookId?: string
): Promise<{ ok: boolean; subgroup: any }> {
  const r = await fetch('/api/subgroups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentKey, name, user, workbookId }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao criar subgrupo')
  }
  return r.json()
}

export async function deleteSubgroup(
  key: string,
  user: string,
  workbookId?: string,
  mode: 'move' | 'delete' = 'move'
): Promise<{ ok: boolean; movedToParent: string; deletedCategoryIds?: string[] }> {
  const r = await fetch('/api/subgroups', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, user, workbookId, mode }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao remover subgrupo')
  }
  return r.json()
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]): Promise<void> {
  const r = await fetch('/api/categories/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) throw new Error('Falha ao reordenar')
}

export async function reorderSubgroups(items: { id: string; sortOrder: number }[]): Promise<void> {
  const r = await fetch('/api/subgroups/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) throw new Error('Falha ao reordenar subgrupos')
}

export async function reorderTopGroups(items: { id: string; sortOrder: number }[]): Promise<void> {
  const r = await fetch('/api/topgroups/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) throw new Error('Falha ao reordenar cards')
}
