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

// DELETE /api/accounts
//   No body (or empty): deletes ALL accounts — used only by the "reset
//   everything" nuclear option.
//   body: { name, password }: deletes ONLY that one account (after verifying
//   the password) plus every workbook that belongs to it — and everything
//   inside those workbooks, via cascade.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const name = body?.name ? String(body.name).trim() : ''
  const password = body?.password ? String(body.password) : ''

  if (!name) {
    // No specific account named — nuclear wipe-everything path.
    await db.account.deleteMany({})
    return NextResponse.json({ ok: true })
  }

  const account = await db.account.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!account) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }
  if (!password) {
    return NextResponse.json({ error: 'Senha é obrigatória para apagar a conta' }, { status: 400 })
  }
  const valid = await bcrypt.compare(password, account.password)
  if (!valid) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  // Deleting each workbook cascades to its categories, transactions,
  // subgroups, top groups (cards), and notes automatically.
  const workbooks = await db.workbook.findMany({
    where: { accountName: { equals: account.name, mode: 'insensitive' } },
    select: { id: true },
  })
  for (const wb of workbooks) {
    await db.workbook.delete({ where: { id: wb.id } })
  }
  await db.account.delete({ where: { id: account.id } })

  return NextResponse.json({ ok: true, deletedWorkbooks: workbooks.length })
}
