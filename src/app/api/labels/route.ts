import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/labels -> returns the labels map { "group:despesas": "...", ... }
// PATCH /api/labels -> body: { key, value, user } — upserts a single label
//   key examples: "group:despesas", "subgroup:despesas.contas_casa"
//   value: the new label string (empty string to reset to default)

export async function GET() {
  const cfg = await db.config.findUnique({ where: { key: 'labels' } })
  let labels: Record<string, string> = {}
  if (cfg) {
    try { labels = JSON.parse(cfg.value) } catch {}
  }
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

  // Load current labels
  const cfg = await db.config.findUnique({ where: { key: 'labels' } })
  let labels: Record<string, string> = {}
  if (cfg) {
    try { labels = JSON.parse(cfg.value) } catch {}
  }

  if (value.trim() === '') {
    delete labels[key]
  } else {
    labels[key] = value
  }

  await db.config.upsert({
    where: { key: 'labels' },
    update: { value: JSON.stringify(labels) },
    create: { key: 'labels', value: JSON.stringify(labels) },
  })

  await db.activityLog.create({
    data: {
      user, action: 'update', entity: 'label',
      detail: value.trim() === ''
        ? `Resetou rótulo "${key}"`
        : `Renomeou "${key}" para "${value}"`,
    },
  })

  return NextResponse.json({ ok: true, labels })
}
