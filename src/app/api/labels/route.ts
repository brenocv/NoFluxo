import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/labels?workbookId=xxx -> returns the labels map for this workbook
// PATCH /api/labels -> body: { key, value, workbookId, user }

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workbookId = url.searchParams.get('workbookId') ?? ''
  const labelsKey = workbookId ? `labels:${workbookId}` : 'labels'
  const cfg = await db.config.findUnique({ where: { key: labelsKey } })
  let labels: Record<string, string> = {}
  if (cfg) { try { labels = JSON.parse(cfg.value) } catch {} }
  return NextResponse.json({ labels })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.key || body.value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const key = String(body.key)
  const value = String(body.value)
  const workbookId = String(body.workbookId ?? '')
  const labelsKey = workbookId ? `labels:${workbookId}` : 'labels'

  const cfg = await db.config.findUnique({ where: { key: labelsKey } })
  let labels: Record<string, string> = {}
  if (cfg) { try { labels = JSON.parse(cfg.value) } catch {} }

  if (value.trim() === '') delete labels[key]
  else labels[key] = value

  await db.config.upsert({
    where: { key: labelsKey },
    update: { value: JSON.stringify(labels) },
    create: { key: labelsKey, value: JSON.stringify(labels) },
  })

  await db.activityLog.create({
    data: { user, action: 'update', entity: 'label',
      detail: value.trim() === '' ? `Resetou rótulo` : `Renomeou para "${value}"` },
  })

  return NextResponse.json({ ok: true, labels })
}
