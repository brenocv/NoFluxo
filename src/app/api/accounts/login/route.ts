import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// POST /api/accounts/login
//   body: { name, password }
//   Verifies credentials against the database (not localStorage), so login
//   works from any browser or device, not just the one that created it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const name = body?.name ? String(body.name).trim() : ''
  const password = body?.password ? String(body.password) : ''

  if (!name || !password) {
    return NextResponse.json({ error: 'Preencha conta e senha' }, { status: 400 })
  }

  const account = await db.account.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!account) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  const valid = await bcrypt.compare(password, account.password)
  if (!valid) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  let users: string[] = []
  try { users = JSON.parse(account.users) } catch {}

  return NextResponse.json({ ok: true, account: { name: account.name, users } })
}
