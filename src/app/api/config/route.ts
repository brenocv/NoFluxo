import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/config
//   body: { key, value, user }
//   Upserts a config entry (used for euroToBrl, year, etc.).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.key || body.value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const key = String(body.key)
  const value = String(body.value)

  const cfg = await db.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })

  await db.activityLog.create({
    data: {
      user,
      action: 'update',
      entity: 'config',
      detail: key === 'euroToBrl'
        ? `Atualizou câmbio Euro → R$ ${value}`
        : `Atualizou configuração "${key}" = ${value}`,
    },
  })

  return NextResponse.json({ ok: true, config: cfg })
}
