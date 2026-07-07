import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/previous-month-balance?year=2026&month=7
//   Returns the realized closing balance of the PREVIOUS month.
//   balance = entradas - saídas (in BRL, EUR converted at euroRate).
//   Excludes any category with excludeFromTotal=true (receivables).
//   If previous month is December of the previous year, fetches that.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026
  const month = parseInt(url.searchParams.get('month') ?? '1', 10) || 1
  const workbookId = url.searchParams.get('workbookId') ?? undefined

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const euroRateRow = await db.config.findUnique({ where: { key: 'euroToBrl' } })
  const euroRate = parseFloat(euroRateRow?.value ?? '6') || 6

  const [categories, transactions] = await Promise.all([
    db.category.findMany({ where: workbookId ? { workbookId } : {} }),
    db.transaction.findMany({
      where: { year: prevYear, month: prevMonth, category: workbookId ? { workbookId } : undefined },
    }),
  ])

  let entradas = 0, saidas = 0
  for (const c of categories) {
    if (c.excludeFromTotal) continue
    const tx = transactions.find((t) => t.categoryId === c.id)
    if (!tx) continue
    const vBRL = c.currency === 'BRL' ? tx.value : tx.value * euroRate
    if (c.type === 'INCOME') entradas += vBRL
    else if (c.type === 'EXPENSE') saidas += vBRL
  }

  const balance = entradas - saidas

  const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return NextResponse.json({
    balance,
    currency: 'BRL',
    prevMonth,
    prevYear,
    prevMonthLabel: `${MONTHS_PT[prevMonth - 1]}/${prevYear}`,
  })
}
