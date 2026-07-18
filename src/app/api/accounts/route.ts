import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// POST /api/accounts
//   body: { name, password }
//   Creates a new account. Names are unique case-insensitively.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const name = body?.name ? String(body.name).trim() : ''
  const password = body?.password ? String(body.password) : ''

  if (!name || !password) {
    return NextResponse.json({ error: 'Preencha conta e senha' }, { status: 400 })
  }
  if (name.length > 60) {
    return NextResponse.json({ error: 'Nome da conta muito longo' }, { status: 400 })
  }

  const existing = await db.account.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Esta conta já existe' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 10)
  const account = await db.account.create({
    data: { name, password: hash, users: '[]' },
  })

  return NextResponse.json({ ok: true, account: { name: account.name, users: [] } })
}

// DELETE /api/accounts -> deletes ALL accounts (used only by the "reset everything" nuclear option)
export async function DELETE() {
  await db.account.deleteMany({})
  return NextResponse.json({ ok: true })
}
