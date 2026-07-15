import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workbooks?accountName=xxx -> returns workbooks for that account
// (If no accountName is provided, returns ALL workbooks — used for admin/debug.)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const accountName = url.searchParams.get('accountName')
  const where = accountName ? { accountName } : {}
  const workbooks = await db.workbook.findMany({ where, orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ workbooks })
}

// POST /api/workbooks -> body: { name, user } — creates a new workbook
//   Optionally accepts `copyFrom` (workbookId) to clone categories/subgroups.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const name = String(body.name).trim().slice(0, 60)
  const accountName = body.accountName ? String(body.accountName).slice(0, 60) : null

  try {
    const maxOrder = await db.workbook.aggregate({ _max: { sortOrder: true } })
    const wb = await db.workbook.create({
      data: { name, accountName, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    })

    // Always create the 3 default TopGroups (cards) so the user sees
    // Despesas / Receitas / Reservas as soon as they open the new workbook.
    const DEFAULT_TOP_GROUPS = [
      { key: 'despesas',    name: 'Despesas',    color: '#dc2626', type: 'EXPENSE', sortOrder: 0 },
      { key: 'rendimentos', name: 'Receitas',    color: '#16a34a', type: 'INCOME',  sortOrder: 1 },
      { key: 'reservas',    name: 'Reservas',    color: '#d97706', type: 'RESERVE', sortOrder: 2 },
    ]
    for (const tg of DEFAULT_TOP_GROUPS) {
      await db.topGroup.create({
        data: {
          workbookId: wb.id,
          key: tg.key,
          name: tg.name,
          color: tg.color,
          type: tg.type,
          sortOrder: tg.sortOrder,
          isDefault: true,
        },
      })
    }

    await db.activityLog.create({
      data: { user, action: 'create', entity: 'config', detail: `Criou planilha "${name}"` },
    })

    return NextResponse.json({ ok: true, workbook: wb })
  } catch (e: any) {
    // Return the actual error message so the client can display it
    return NextResponse.json(
      { error: e.message || 'Erro interno ao criar planilha' },
      { status: 500 }
    )
  }
}

// PATCH /api/workbooks -> body: { id, name, user } — renames a workbook
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id || !body.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const name = String(body.name).trim().slice(0, 60)

  const wb = await db.workbook.update({
    where: { id: String(body.id) },
    data: { name },
  })

  await db.activityLog.create({
    data: { user, action: 'update', entity: 'config', detail: `Renomeou planilha para "${name}"` },
  })

  return NextResponse.json({ ok: true, workbook: wb })
}

// DELETE /api/workbooks -> body: { id, user }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const count = await db.workbook.count()
  // Allow deleting last workbook if user is 'reset' (full reset)
  if (count <= 1 && user !== 'reset') {
    return NextResponse.json({ error: 'Não é possível remover a única planilha' }, { status: 400 })
  }

  const wb = await db.workbook.findUnique({ where: { id: String(body.id) } })
  if (!wb) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await db.workbook.delete({ where: { id: wb.id } })

  await db.activityLog.create({
    data: { user, action: 'delete', entity: 'config', detail: `Removeu planilha "${wb.name}"` },
  })

  return NextResponse.json({ ok: true })
}
