import { NextRequest, NextResponse } from 'next/server'
import { db, getWorkbookAccountName } from '@/lib/db'

// GET /api/topgroups?workbookId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workbookId = url.searchParams.get('workbookId') ?? ''
  const groups = await db.topGroup.findMany({
    where: workbookId ? { workbookId } : {},
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ topGroups: groups })
}

// POST /api/topgroups -> body: { workbookId, name, color, type, user }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.workbookId || !body.name) {
    return NextResponse.json({ error: 'workbookId and name are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const name = String(body.name).trim().slice(0, 60)

  // Generate a slug key from the name
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'grupo'

  // Ensure uniqueness within workbook
  let key = slug
  let suffix = 2
  while (await db.topGroup.findFirst({ where: { workbookId: body.workbookId, key } })) {
    key = `${slug}_${suffix++}`
  }

  const maxOrder = await db.topGroup.aggregate({
    where: { workbookId: body.workbookId },
    _max: { sortOrder: true },
  })

  const tg = await db.topGroup.create({
    data: {
      workbookId: body.workbookId,
      key,
      name,
      color: String(body.color || '#64748b'),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      type: String(body.type || 'EXPENSE'),
      isDefault: false,
    },
  })

  await db.activityLog.create({
    data: { user, action: 'create', entity: 'config', detail: `Criou card "${name}"`, accountName: await getWorkbookAccountName(tg.workbookId) },
  })

  return NextResponse.json({ ok: true, topGroup: tg })
}

// PATCH /api/topgroups -> body: { id, name?, color?, user }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const data: any = {}
  if (body.name !== undefined) data.name = String(body.name)
  if (body.color !== undefined) data.color = String(body.color)

  const tg = await db.topGroup.update({ where: { id: String(body.id) }, data })

  await db.activityLog.create({
    data: { user, action: 'update', entity: 'config', detail: `Editou card "${tg.name}"`, accountName: await getWorkbookAccountName(tg.workbookId) },
  })

  return NextResponse.json({ ok: true, topGroup: tg })
}

// DELETE /api/topgroups -> body: { id, user }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const tg = await db.topGroup.findUnique({ where: { id: String(body.id) } })
  if (!tg) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (tg.isDefault) return NextResponse.json({ error: 'Não é possível remover cards padrão' }, { status: 400 })

  // Move all categories to the first available top group
  const otherGroups = await db.topGroup.findMany({
    where: { workbookId: tg.workbookId, NOT: { id: tg.id } },
    orderBy: { sortOrder: 'asc' },
  })
  if (otherGroups.length > 0) {
    const fallbackKey = otherGroups[0].key
    await db.category.updateMany({
      where: { group: { startsWith: tg.key }, workbookId: tg.workbookId },
      data: { group: fallbackKey },
    })
  }

  // Delete subgroups under this top group
  await db.subgroup.deleteMany({
    where: { parentKey: tg.key, workbookId: tg.workbookId },
  })

  await db.topGroup.delete({ where: { id: tg.id } })

  await db.activityLog.create({
    data: { user, action: 'delete', entity: 'config', detail: `Removeu card "${tg.name}"`, accountName: await getWorkbookAccountName(tg.workbookId) },
  })

  return NextResponse.json({ ok: true })
}
