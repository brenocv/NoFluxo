import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions/series-stop
//   body: { seriesId, currentMonth, currentYear, user }
//
// Stops a recurring series: deletes all transactions in the series that come
// AFTER (currentYear, currentMonth) — including those in future years.
// The current month's transaction remains but is detached from the series
// (isRecurring=false, seriesId=null).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.seriesId || !body.currentMonth) {
    return NextResponse.json({ error: 'seriesId and currentMonth are required' }, { status: 400 })
  }

  const seriesId = String(body.seriesId)
  const currentMonth = Number(body.currentMonth)
  const currentYear = Number(body.currentYear ?? 2026)
  const user = String(body.user || 'Anônimo').slice(0, 30)

  // Delete future installments — across years.
  // A transaction is "future" if:
  //   year > currentYear, OR
  //   year == currentYear AND month > currentMonth
  const deleted = await db.transaction.deleteMany({
    where: {
      seriesId,
      OR: [
        { year: { gt: currentYear } },
        { year: currentYear, month: { gt: currentMonth } },
      ],
    },
  })

  // Detach the current transaction from the series
  const current = await db.transaction.findFirst({
    where: { seriesId, year: currentYear, month: currentMonth },
  })
  if (current) {
    await db.transaction.update({
      where: { id: current.id },
      data: { isRecurring: false, seriesId: null, installmentNumber: null, installmentsTotal: null },
    })
  }

  const category = current
    ? await db.category.findUnique({ where: { id: current.categoryId } })
    : null

  await db.activityLog.create({
    data: {
      user, action: 'delete', entity: 'transaction',
      detail: `Desligou recorrência${category ? ` de "${category.name}"` : ''} • ${deleted.count} parcela(s) futura(s) removida(s)`,
    },
  })

  return NextResponse.json({
    ok: true,
    deletedCount: deleted.count,
    detachedTransaction: current,
    category,
  })
}
