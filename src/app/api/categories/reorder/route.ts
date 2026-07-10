import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/categories/reorder
//   body: { items: [{ id, sortOrder }], user }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 })
  }

  for (const item of body.items) {
    if (item.id && item.sortOrder !== undefined) {
      await db.category.update({
        where: { id: String(item.id) },
        data: { sortOrder: Number(item.sortOrder) },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
