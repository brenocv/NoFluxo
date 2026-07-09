import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/subgroups
//   body: { parentKey, name, workbookId, user }
// DELETE /api/subgroups
//   body: { key, workbookId, user }

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'subgrupo'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.parentKey || !body.name || !body.workbookId) {
    return NextResponse.json({ error: 'parentKey, name and workbookId are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const parentKey = String(body.parentKey)
  const name = String(body.name).trim().slice(0, 60)
  const wbid = String(body.workbookId)
  if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })

  // Validate parentKey: must be a TopGroup OR an existing Subgroup in this workbook
  const isTopGroup = await db.topGroup.findFirst({ where: { key: parentKey, workbookId: wbid } })
  const isSubgroup = await db.subgroup.findFirst({ where: { key: parentKey, workbookId: wbid } })
  if (!isTopGroup && !isSubgroup) {
    return NextResponse.json({ error: 'parentKey inválido' }, { status: 400 })
  }

  // Allow caller to specify an explicit key (used during undo/restore).
  // Otherwise generate from name.
  let key: string
  if (body.key && typeof body.key === 'string' && body.key.startsWith(parentKey + '.')) {
    key = String(body.key)
    // If key already exists, fall back to auto-generation
    if (await db.subgroup.findFirst({ where: { key, workbookId: wbid } })) {
      key = parentKey + '.' + slugify(name)
    }
  } else {
    const baseSlug = slugify(name)
    key = parentKey + '.' + baseSlug
  }
  // Ensure uniqueness
  let suffix = 2
  while (await db.subgroup.findFirst({ where: { key, workbookId: wbid } })) {
    key = parentKey + '.' + slugify(name) + '_' + suffix++
  }

  // Compute sortOrder (allow caller to specify)
  let sortOrder: number
  if (typeof body.sortOrder === 'number') {
    sortOrder = body.sortOrder
  } else {
    const minOrder = await db.subgroup.aggregate({
      where: { parentKey, workbookId: wbid },
      _min: { sortOrder: true },
    })
    sortOrder = (minOrder._min.sortOrder ?? 1) - 1
  }

  const sg = await db.subgroup.create({
    data: { workbookId: wbid, key, parentKey, name, sortOrder },
  })

  await db.activityLog.create({
    data: { user, action: 'create', entity: 'subgroup', detail: 'Criou subgrupo "' + name + '"' },
  })

  return NextResponse.json({ ok: true, subgroup: sg })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.key || !body.workbookId) {
    return NextResponse.json({ error: 'key and workbookId are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const key = String(body.key)
  const wbid = String(body.workbookId)
  const mode: 'move' | 'delete' = body.mode === 'delete' ? 'delete' : 'move'

  const sg = await db.subgroup.findFirst({ where: { key, workbookId: wbid } })
  if (!sg) return NextResponse.json({ error: 'subgroup not found' }, { status: 404 })

  const parentKey = sg.parentKey

  // Find all descendant subgroup keys (recursive) within this workbook
  const allSubgroups = await db.subgroup.findMany({ where: { workbookId: wbid } })
  const descendants = collectDescendants(key, allSubgroups)

  // All subgroup keys involved (the subgroup + descendants)
  const allKeys = [key, ...descendants]

  // Find all categories that belong to these subgroups (for either mode)
  const affectedCategories = await db.category.findMany({
    where: { group: { in: allKeys }, workbookId: wbid },
    select: { id: true },
  })
  const deletedCategoryIds = affectedCategories.map((c) => c.id)

  if (mode === 'delete') {
    // Delete all categories (and their transactions) in this subgroup + descendants
    if (deletedCategoryIds.length > 0) {
      await db.transaction.deleteMany({
        where: { categoryId: { in: deletedCategoryIds } },
      })
      await db.category.deleteMany({
        where: { id: { in: deletedCategoryIds } },
      })
    }
  } else {
    // Move all categories in this subgroup and its descendants to the parent
    await db.category.updateMany({
      where: { group: { in: allKeys }, workbookId: wbid },
      data: { group: parentKey },
    })
  }

  // Delete all descendant subgroups
  await db.subgroup.deleteMany({
    where: { key: { in: descendants }, workbookId: wbid },
  })
  // Delete the subgroup itself
  await db.subgroup.delete({ where: { id: sg.id } })

  await db.activityLog.create({
    data: {
      user, action: 'delete', entity: 'subgroup',
      detail: 'Removeu subgrupo "' + sg.name + '"' + (mode === 'delete' ? ' (categorias excluídas)' : ' (categorias movidas)'),
    },
  })

  return NextResponse.json({
    ok: true,
    movedToParent: mode === 'delete' ? '' : parentKey,
    deletedCategoryIds: mode === 'delete' ? deletedCategoryIds : [],
    mode,
  })
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
