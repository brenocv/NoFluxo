import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions
//   body: { categoryId, month, year?, value, note?, user }
//   - If a transaction already exists for (categoryId, year, month) it is updated.
//   - If value is null/undefined, the transaction is deleted (so the user can clear a cell).
// Returns the saved (or deleted) transaction.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.categoryId || !body.month) {
    return NextResponse.json({ error: 'categoryId and month are required' }, { status: 400 })
  }

  const categoryId = String(body.categoryId)
  const month = Number(body.month)
  const year = Number(body.year ?? new Date().getFullYear())
  const value = body.value === null || body.value === undefined || body.value === ''
    ? null
    : Number(body.value)
  const note = body.note ? String(body.note) : null
  const user = String(body.user || 'Anônimo').slice(0, 30)

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 })
  }
  if (value !== null && isNaN(value)) {
    return NextResponse.json({ error: 'value must be a number or null' }, { status: 400 })
  }

  const category = await db.category.findUnique({ where: { id: categoryId } })
  if (!category) {
    return NextResponse.json({ error: 'category not found' }, { status: 404 })
  }

  let result: any
  let action: 'create' | 'update' | 'delete'
  const existing = await db.transaction.findUnique({
    where: { categoryId_year_month: { categoryId, year, month } },
  })

  if (value === null) {
    if (existing) {
      await db.transaction.delete({ where: { id: existing.id } })
      result = null
      action = 'delete'
    } else {
      // Nothing to delete — no-op
      return NextResponse.json({ ok: true, action: 'noop', transaction: null })
    }
  } else {
    if (existing) {
      result = await db.transaction.update({
        where: { id: existing.id },
        data: { value, note },
      })
      action = 'update'
    } else {
      result = await db.transaction.create({
        data: { categoryId, year, month, value, note },
      })
      action = 'create'
    }
  }

  // Log activity
  const monthName = MONTHS_PT[month - 1]
  await db.activityLog.create({
    data: {
      user,
      action,
      entity: 'transaction',
      detail: `${action === 'delete' ? 'Removeu' : action === 'create' ? 'Adicionou' : 'Atualizou'} ${category.name} • ${monthName}/${year}${value !== null ? ` • ${formatMoney(value, category.currency)}` : ''}`,
    },
  })

  return NextResponse.json({ ok: true, action, transaction: result, category })
}

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function formatMoney(v: number, currency: 'BRL' | 'EUR') {
  if (currency === 'BRL') return `R$ ${v.toFixed(2)}`
  return `€ ${v.toFixed(2)}`
}
