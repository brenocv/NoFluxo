import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions/copy-month
//   body: { fromYear, fromMonth, toYear, toMonth, user }
//
// Copies ALL transactions from (fromYear, fromMonth) to (toYear, toMonth).
// If a transaction already exists for a given category in the target month,
// it is updated. Otherwise, a new transaction is created.
//
// Recurring transactions: the copy creates standalone (non-recurring)
// transactions in the target month — it does NOT extend the series.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || body.fromMonth == null || body.toMonth == null) {
    return NextResponse.json({ error: 'fromMonth and toMonth are required' }, { status: 400 })
  }

  const fromYear = Number(body.fromYear ?? 2026)
  const fromMonth = Number(body.fromMonth)
  const toYear = Number(body.toYear ?? fromYear)
  const toMonth = Number(body.toMonth)
  const user = String(body.user || 'Anônimo').slice(0, 30)

  if (fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12) {
    return NextResponse.json({ error: 'months must be 1-12' }, { status: 400 })
  }

  // Fetch all source transactions
  const sourceTxs = await db.transaction.findMany({
    where: { year: fromYear, month: fromMonth },
  })

  if (sourceTxs.length === 0) {
    return NextResponse.json({ ok: false, error: 'Mês de origem não tem valores para copiar' }, { status: 400 })
  }

  const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const created: any[] = []
  const updated: any[] = []

  for (const src of sourceTxs) {
    // Check if target already has a transaction for this category
    const existing = await db.transaction.findUnique({
      where: {
        categoryId_year_month: {
          categoryId: src.categoryId,
          year: toYear,
          month: toMonth,
        },
      },
    })

    if (existing) {
      const u = await db.transaction.update({
        where: { id: existing.id },
        data: {
          value: src.value,
          note: src.note,
          // Detach from any series when copying — the copy is standalone
          isRecurring: false,
          seriesId: null,
          installmentNumber: null,
          installmentsTotal: null,
        },
      })
      updated.push(u)
    } else {
      const c = await db.transaction.create({
        data: {
          categoryId: src.categoryId,
          year: toYear,
          month: toMonth,
          value: src.value,
          note: src.note,
          // Standalone copy
        },
      })
      created.push(c)
    }
  }

  await db.activityLog.create({
    data: {
      user, action: 'create', entity: 'transaction',
      detail: `Copiou ${sourceTxs.length} valor(es) de ${MONTHS_PT[fromMonth - 1]}/${fromYear} para ${MONTHS_PT[toMonth - 1]}/${toYear}`,
    },
  })

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    updatedCount: updated.length,
    total: sourceTxs.length,
    transactions: [...created, ...updated],
  })
}
