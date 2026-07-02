import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions/reset
//   body: { scope: 'month' | 'year', year, month?, user }
//
// Deletes transactions:
//   - scope='month': deletes all transactions for (year, month)
//   - scope='year':  deletes all transactions for the entire year
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.scope || !body.year) {
    return NextResponse.json({ error: 'scope and year are required' }, { status: 400 })
  }

  const scope = String(body.scope) as 'month' | 'year'
  const year = Number(body.year)
  const month = body.month ? Number(body.month) : null
  const user = String(body.user || 'Anônimo').slice(0, 30)

  let where: any = { year }
  let detail = ''

  if (scope === 'month') {
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month is required for scope=month' }, { status: 400 })
    }
    where = { year, month }
    const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    detail = `Zerou todos os valores de ${MONTHS_PT[month - 1]}/${year}`
  } else {
    detail = `Zerou todos os valores de ${year}`
  }

  const result = await db.transaction.deleteMany({ where })

  await db.activityLog.create({
    data: { user, action: 'delete', entity: 'transaction', detail },
  })

  return NextResponse.json({ ok: true, deletedCount: result.count, scope, year, month })
}
