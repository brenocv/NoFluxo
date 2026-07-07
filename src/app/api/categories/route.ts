import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/categories
//   body: { name, group, type, currency, note?, sortOrder?, excludeFromTotal?, monthlyGoal?, user }
// PATCH /api/categories
//   body: { id, name?, note?, sortOrder?, excludeFromTotal?, monthlyGoal?, user }
// DELETE /api/categories
//   body: { id, user }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.name || !body.group || !body.type) {
    return NextResponse.json({ error: 'name, group, type are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const maxOrder = await db.category.aggregate({
    where: { group: body.group, workbookId: body.workbookId },
    _max: { sortOrder: true },
  })
  const sortOrder = body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1

  const cat = await db.category.create({
    data: {
      workbookId: String(body.workbookId),
      name: String(body.name),
      group: String(body.group),
      type: String(body.type),
      currency: String(body.currency || 'BRL'),
      note: body.note ? String(body.note) : null,
      sortOrder,
      excludeFromTotal: !!body.excludeFromTotal,
      monthlyGoal: body.monthlyGoal ? Number(body.monthlyGoal) : null,
      parentCategoryId: body.parentCategoryId ? String(body.parentCategoryId) : null,
    },
  })

  await db.activityLog.create({
    data: {
      user, action: 'create', entity: 'category',
      detail: `Criou categoria "${cat.name}"`,
    },
  })

  return NextResponse.json({ ok: true, category: cat })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const data: any = {}
  if (body.name !== undefined) data.name = String(body.name)
  if (body.note !== undefined) data.note = body.note ? String(body.note) : null
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)
  if (body.excludeFromTotal !== undefined) data.excludeFromTotal = !!body.excludeFromTotal
  if (body.monthlyGoal !== undefined) {
    data.monthlyGoal = body.monthlyGoal === null || body.monthlyGoal === ''
      ? null
      : Number(body.monthlyGoal)
  }

  const cat = await db.category.update({ where: { id: String(body.id) }, data })
  await db.activityLog.create({
    data: {
      user, action: 'update', entity: 'category',
      detail: `Editou categoria "${cat.name}"`,
    },
  })
  return NextResponse.json({ ok: true, category: cat })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const cat = await db.category.findUnique({ where: { id: String(body.id) } })
  if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await db.category.delete({ where: { id: cat.id } })
  await db.activityLog.create({
    data: {
      user, action: 'delete', entity: 'category',
      detail: `Removeu categoria "${cat.name}"`,
    },
  })
  return NextResponse.json({ ok: true })
}
