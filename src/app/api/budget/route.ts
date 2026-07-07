import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/budget?year=2026 -> returns the savings goal for the year
// POST /api/budget -> body: { year, goal, user } — sets the savings goal
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026
  const workbookId = url.searchParams.get('workbookId') ?? ''

  const budgetKey = `budget:${workbookId}:${year}`
  const row = await db.config.findUnique({ where: { key: budgetKey } })
  const goal = row ? parseFloat(row.value) : 0

  const [categories, transactions, euroRateRow] = await Promise.all([
    db.category.findMany({ where: workbookId ? { workbookId } : {} }),
    db.transaction.findMany({ where: { year, category: workbookId ? { workbookId } : undefined } }),
    db.config.findUnique({ where: { key: 'euroToBrl' } }),
  ])
  const euroRate = parseFloat(euroRateRow?.value ?? '6') || 6

  let entradas = 0, saidas = 0
  for (const c of categories) {
    if (c.excludeFromTotal) continue
    const txs = transactions.filter((t) => t.categoryId === c.id)
    for (const t of txs) {
      const vBRL = c.currency === 'BRL' ? t.value : t.value * euroRate
      if (c.type === 'INCOME') entradas += vBRL
      else if (c.type === 'EXPENSE') saidas += vBRL
    }
  }
  const currentSavings = entradas - saidas

  return NextResponse.json({
    year,
    goal,
    current: currentSavings,
    progress: goal > 0 ? (currentSavings / goal) * 100 : 0,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || body.year == null || body.goal === undefined) {
    return NextResponse.json({ error: 'year and goal are required' }, { status: 400 })
  }
  const year = Number(body.year)
  const goal = Number(body.goal)
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const workbookId = String(body.workbookId ?? '')
  const budgetKey = `budget:${workbookId}:${year}`

  await db.config.upsert({
    where: { key: budgetKey },
    update: { value: String(goal) },
    create: { key: budgetKey, value: String(goal) },
  })

  await db.activityLog.create({
    data: {
      user, action: 'update', entity: 'config',
      detail: `Definiu meta de poupança de ${year}: R$ ${goal.toFixed(2)}`,
    },
  })

  return NextResponse.json({ ok: true, year, goal })
}
