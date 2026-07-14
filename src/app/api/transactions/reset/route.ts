import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions/reset
//   body: { scope: 'month' | 'year' | 'factory', year, month?, workbookId?, user }
//
// scope='month':   deletes all transactions for (year, month)
// scope='year':    deletes all transactions for the entire year
// scope='factory': wipes EVERYTHING back to a freshly-created workbook state:
//                  - deletes ALL transactions of the workbook
//                  - deletes ALL categories of the workbook (so items/sub-items disappear)
//                  - deletes ALL non-default subgroups of the workbook
//                  - keeps the 3 default TopGroups (Despesas/Rendimentos/Reservas)
//                  - keeps the 5 default subgroups (cartoes, contas_casa, brl, eur, valores_a_receber)
//                  - keeps the workbook itself and config (currency rates, labels)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.scope) {
    return NextResponse.json({ error: 'scope is required' }, { status: 400 })
  }

  const scope = String(body.scope) as 'month' | 'year' | 'factory'
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // ---- Factory reset: wipe everything except default structure ----
  if (scope === 'factory') {
    const workbookId = String(body.workbookId || '')
    if (!workbookId) {
      return NextResponse.json({ error: 'workbookId is required for scope=factory' }, { status: 400 })
    }

    // 1. Delete all transactions belonging to categories in this workbook
    const cats = await db.category.findMany({ where: { workbookId }, select: { id: true } })
    const catIds = cats.map((c) => c.id)
    const txResult = catIds.length > 0
      ? await db.transaction.deleteMany({ where: { categoryId: { in: catIds } } })
      : { count: 0 }

    // 2. Delete all categories of the workbook (items + sub-items)
    const catResult = await db.category.deleteMany({ where: { workbookId } })

    // 3. Delete non-default subgroups (keep the 5 default ones)
    const defaultSubKeys = [
      'despesas.cartoes',
      'despesas.contas_casa',
      'rendimentos.brl',
      'rendimentos.eur',
      'rendimentos.valores_a_receber',
    ]
    const subResult = await db.subgroup.deleteMany({
      where: { workbookId, key: { notIn: defaultSubKeys } },
    })

    // 4. Delete non-default topGroups (keep despesas/rendimentos/reservas)
    const defaultTopKeys = ['despesas', 'rendimentos', 'reservas']
    const topResult = await db.topGroup.deleteMany({
      where: { workbookId, key: { notIn: defaultTopKeys } },
    })

    // 5. ENSURE the 3 default TopGroups exist (create if missing — this can
    // happen if the workbook was created before the "defaults on create" fix,
    // or if a user accidentally deleted one).
    const DEFAULT_TOP_GROUPS = [
      { key: 'despesas',    name: 'Despesas',    color: '#dc2626', type: 'EXPENSE', sortOrder: 0 },
      { key: 'rendimentos', name: 'Rendimentos', color: '#16a34a', type: 'INCOME',  sortOrder: 1 },
      { key: 'reservas',    name: 'Reservas',    color: '#d97706', type: 'RESERVE', sortOrder: 2 },
    ]
    for (const tg of DEFAULT_TOP_GROUPS) {
      const exists = await db.topGroup.findUnique({
        where: { workbookId_key: { workbookId, key: tg.key } },
      })
      if (!exists) {
        await db.topGroup.create({
          data: { ...tg, workbookId, isDefault: true },
        })
      }
    }

    // 6. ENSURE the 5 default subgroups exist (create if missing)
    const DEFAULT_SUBGROUPS = [
      { key: 'despesas.cartoes',                parentKey: 'despesas',    name: 'Cartões BR',        sortOrder: 0 },
      { key: 'despesas.contas_casa',            parentKey: 'despesas',    name: 'Contas casa',       sortOrder: 1 },
      { key: 'rendimentos.brl',                 parentKey: 'rendimentos', name: 'Em Real (R$)',      sortOrder: 0 },
      { key: 'rendimentos.eur',                 parentKey: 'rendimentos', name: 'Em Euro (€)',       sortOrder: 1 },
      { key: 'rendimentos.valores_a_receber',   parentKey: 'rendimentos', name: 'Valores a receber', sortOrder: 2 },
    ]
    for (const sg of DEFAULT_SUBGROUPS) {
      const exists = await db.subgroup.findUnique({
        where: { workbookId_key: { workbookId, key: sg.key } },
      })
      if (!exists) {
        await db.subgroup.create({
          data: { ...sg, workbookId },
        })
      }
    }

    const detail = `Resetou a planilha para o estado inicial (${txResult.count} transações, ${catResult.count} itens, ${subResult.count} subgrupos, ${topResult.count} cards removidos)`
    await db.activityLog.create({
      data: { user, action: 'delete', entity: 'transaction', detail },
    })

    return NextResponse.json({
      ok: true,
      scope: 'factory',
      deletedCount: txResult.count,
      deletedCategories: catResult.count,
      deletedSubgroups: subResult.count,
      deletedTopGroups: topResult.count,
    })
  }

  // ---- Month/Year reset ----
  const year = Number(body.year)
  if (!year) {
    return NextResponse.json({ error: 'year is required for month/year scope' }, { status: 400 })
  }
  const month = body.month ? Number(body.month) : null

  let where: any = { year }
  let detail = ''

  if (scope === 'month') {
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month is required for scope=month' }, { status: 400 })
    }
    where = { year, month }
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
