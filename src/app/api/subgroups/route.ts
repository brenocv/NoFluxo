import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { GROUP_STRUCTURE, TOP_GROUP_ORDER } from '@/lib/finance'

// POST /api/subgroups
//   body: { parentKey, name, user }
//   Creates a new subgroup inside `parentKey`. The parentKey can be a top-level
//   key (e.g. "despesas") or any existing subgroup key (e.g. "despesas.contas_casa").
//   Returns the created subgroup.
//
// DELETE /api/subgroups
//   body: { key, user }
//   Deletes the subgroup. All categories inside it (and its sub-subgroups) are
//   moved up to the parent group. Sub-subgroups are also moved to the parent.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'subgrupo'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.parentKey || !body.name) {
    return NextResponse.json({ error: 'parentKey and name are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const parentKey = String(body.parentKey)
  const name = String(body.name).trim().slice(0, 60)
  if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })

  // Validate parentKey: must be a top-level key OR an existing subgroup
  const isTopLevel = TOP_GROUP_ORDER.includes(parentKey as any)
  const isDefaultSubgroup = GROUP_STRUCTURE.some((g) =>
    g.subgroups.some((s) => s.key === parentKey)
  )
  const isUserSubgroup = await db.subgroup.findUnique({ where: { key: parentKey } })

  if (!isTopLevel && !isDefaultSubgroup && !isUserSubgroup) {
    return NextResponse.json({ error: 'parentKey inválido' }, { status: 400 })
  }

  // Generate a unique key within this workbook
  const baseSlug = slugify(name)
  let key = `${parentKey}.${baseSlug}`
  let suffix = 2
  const wbid = String(body.workbookId)
  while (await db.subgroup.findFirst({ where: { key, workbookId: wbid } })) {
    key = `${parentKey}.${baseSlug}_${suffix++}`
  }

  // Compute sortOrder
  const maxOrder = await db.subgroup.aggregate({
    where: { parentKey, workbookId: wbid },
    _max: { sortOrder: true },
  })
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1

  const sg = await db.subgroup.create({
    data: { workbookId: wbid, key, parentKey, name, sortOrder },
  })

  await db.activityLog.create({
    data: {
      user, action: 'create', entity: 'subgroup',
      detail: `Criou subgrupo "${name}"`,
    },
  })

  return NextResponse.json({ ok: true, subgroup: sg })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const key = String(body.key)

  const wbid = String(body.workbookId)
  const sg = await db.subgroup.findFirst({ where: { key, workbookId: wbid } })
  if (!sg) return NextResponse.json({ error: 'subgroup not found' }, { status: 404 })

  const parentKey = sg.parentKey

  // Find all descendant subgroup keys (recursive) within this workbook
  const allSubgroups = await db.subgroup.findMany({ where: { workbookId: wbid } })
  const descendants = collectDescendants(key, allSubgroups)

  // Move all categories in this subgroup and its descendants to the parent
  const allKeys = [key, ...descendants]
  await db.category.updateMany({
    where: { group: { in: allKeys }, workbookId: wbid },
    data: { group: parentKey },
  })

  // Delete all descendant subgroups
  await db.subgroup.deleteMany({
    where: { key: { in: descendants }, workbookId: wbid },
  })
  // Delete the subgroup itself
  await db.subgroup.delete({ where: { id: sg.id } })

  await db.activityLog.create({
    data: {
      user, action: 'delete', entity: 'subgroup',
      detail: `Removeu subgrupo "${sg.name}" (categorias movidas para o grupo pai)`,
    },
  })

  return NextResponse.json({ ok: true, movedToParent: parentKey })
}

function collectDescendants(parentKey: string, all: { key: string; parentKey: string }[]): string[] {
  const children = all.filter((s) => s.parentKey === parentKey)
  const result: string[] = []
  for (const child of children) {
    result.push(child.key)
    result.push(...collectDescendants(child.key, all))
  }
  return result
}
