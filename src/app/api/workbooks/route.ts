import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workbooks?accountName=xxx -> returns workbooks for that account
// (If no accountName is provided, returns ALL workbooks — used for admin/debug.)
//
// Matching is case-insensitive, consistent with account login. If NO
// workbook matches this account but there's exactly one orphaned legacy
// workbook (accountName is null — from before the Account system existed),
// it's automatically claimed for this account instead of silently staying
// invisible, which was causing a fresh empty workbook to get created instead
// of finding the user's real, pre-existing data.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const accountName = url.searchParams.get('accountName')
  const where = accountName ? { accountName: { equals: accountName, mode: 'insensitive' as const } } : {}
  let workbooks = await db.workbook.findMany({ where, orderBy: { sortOrder: 'asc' } })

  if (accountName && workbooks.length === 0) {
    const orphaned = await db.workbook.findMany({ where: { accountName: null } })
    if (orphaned.length === 1) {
      const claimed = await db.workbook.update({
        where: { id: orphaned[0].id },
        data: { accountName },
      })
      workbooks = [claimed]
    }
  }

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

  const maxOrder = await db.workbook.aggregate({ _max: { sortOrder: true } })
  const wb = await db.workbook.create({
    data: { name, accountName, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })

  // Always create the 3 default TopGroups (cards) so the user sees
  // Despesas / Receitas / Reservas as soon as they open the new workbook.
  // Without these, the page renders an empty tree and any attempt to add a
  // value crashes because there's no group to attach it to.
  // Per user request: NO default subgroups — the 3 cards start completely empty.
  // The user creates subgroups themselves via the FolderPlus button on each card.
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

  // NOTE: New workbooks are always created ZEROED:
  // - Only the 3 default cards (Despesas, Receitas, Reservas) — NO subgroups
  // - No categories, no transactions
  // - Currency config starts clean: BRL primary, EUR secondary (default rate 6)
  //   No custom currencies are carried over from other workbooks.

  await db.activityLog.create({
    data: { user, action: 'create', entity: 'config', detail: `Criou planilha "${name}"`, accountName: wb.accountName },
  })

  return NextResponse.json({ ok: true, workbook: wb })
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
    data: { user, action: 'update', entity: 'config', detail: `Renomeou planilha para "${name}"`, accountName: wb.accountName },
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
    data: { user, action: 'delete', entity: 'config', detail: `Removeu planilha "${wb.name}"`, accountName: wb.accountName },
  })

  return NextResponse.json({ ok: true })
}
