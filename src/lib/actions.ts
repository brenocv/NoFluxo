'use client'

// Thin wrapper around the API calls. Each function:
//   1. POSTs to the relevant /api route
//   2. Returns the server result so the caller can both update local state
//      and broadcast a change message via socket.io
import { Category, Currency } from '@/lib/finance'

export interface SaveTransactionArgs {
  categoryId: string
  month: number
  year?: number
  value: number | null
  note?: string | null
  user: string
}

export interface SaveTransactionResult {
  ok: boolean
  action: 'create' | 'update' | 'delete' | 'noop'
  transaction: any
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
  return r.json()
}

export interface SaveCategoryArgs {
  name: string
  group: string
  type: 'EXPENSE' | 'INCOME' | 'RESERVE'
  currency: Currency
  note?: string
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
