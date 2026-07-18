import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/accounts/users?name=xxx -> { users: string[] }
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const name = url.searchParams.get('name')?.trim() ?? ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const account = await db.account.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  let users: string[] = []
  try { users = JSON.parse(account.users) } catch {}
  return NextResponse.json({ users })
}

// POST /api/accounts/users
//   body: { accountName, userName }
//   Adds a new user display name to an account (e.g. adding a family member).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const accountName = body?.accountName ? String(body.accountName).trim() : ''
  const userName = body?.userName ? String(body.userName).trim() : ''
  if (!accountName || !userName) {
    return NextResponse.json({ error: 'accountName and userName are required' }, { status: 400 })
  }

  const account = await db.account.findFirst({
    where: { name: { equals: accountName, mode: 'insensitive' } },
  })
  if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  let users: string[] = []
  try { users = JSON.parse(account.users) } catch {}
  if (!users.some((u) => u.toLowerCase() === userName.toLowerCase())) {
    users.push(userName)
    await db.account.update({ where: { id: account.id }, data: { users: JSON.stringify(users) } })
  }

  return NextResponse.json({ ok: true, users })
}
