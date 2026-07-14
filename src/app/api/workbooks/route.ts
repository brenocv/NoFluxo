import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workbooks -> returns all workbooks
export async function GET() {
  const workbooks = await db.workbook.findMany({ orderBy: { sortOrder: 'asc' } })
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

  const maxOrder = await db.workbook.aggregate({ _max: { sortOrder: true } })
  const wb = await db.workbook.create({
    data: { name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })

  // If copyFrom is provided, clone categories and subgroups (structure only, no transactions)
  if (body.copyFrom) {
    const sourceCats = await db.category.findMany({ where: { workbookId: String(body.copyFrom) } })
    const sourceSubs = await db.subgroup.findMany({ where: { workbookId: String(body.copyFrom) } })

    // Clone subgroups
    for (const sg of sourceSubs) {
      await db.subgroup.create({
        data: {
          workbookId: wb.id,
          key: sg.key,
          parentKey: sg.parentKey,
          name: sg.name,
          sortOrder: sg.sortOrder,
        },
      })
    }

    // Clone categories (need to remap parentCategoryId)
    const idMap: Record<string, string> = {}
    // First pass: create without parent
    for (const c of sourceCats) {
      const newCat = await db.category.create({
        data: {
          workbookId: wb.id,
          name: c.name,
          group: c.group,
          type: c.type,
          currency: c.currency,
          note: c.note,
          sortOrder: c.sortOrder,
          autoConvert: c.autoConvert,
          excludeFromTotal: c.excludeFromTotal,
          monthlyGoal: c.monthlyGoal,
          parentCategoryId: null, // set in second pass
        },
      })
      idMap[c.id] = newCat.id
    }
    // Second pass: set parents
    for (const c of sourceCats) {
      if (c.parentCategoryId && idMap[c.parentCategoryId]) {
        await db.category.update({
          where: { id: idMap[c.id] },
          data: { parentCategoryId: idMap[c.parentCategoryId] },
        })
      }
    }
  }

  await db.activityLog.create({
    data: { user, action: 'create', entity: 'config', detail: `Criou planilha "${name}"` },
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
