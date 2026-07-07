import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026
  const month = parseInt(url.searchParams.get('month') ?? '1', 10) || 1
  const workbookId = url.searchParams.get('workbookId') ?? ''

  const exact = await db.note.findUnique({ where: { workbookId_year_month: { workbookId, year, month } } })
  if (exact) return NextResponse.json({ note: exact, isRecurringFrom: false })

  // Look backwards for recurring
  let y = year, m = month
  for (let i = 0; i < 24; i++) {
    m--; if (m < 1) { m = 12; y-- }
    const prev = await db.note.findUnique({ where: { workbookId_year_month: { workbookId, year: y, month: m } } })
    if (prev) {
      if (prev.isRecurring) {
        return NextResponse.json({ note: prev, isRecurringFrom: true, sourceMonth: m, sourceYear: y })
      }
      break
    }
  }
  return NextResponse.json({ note: null, isRecurringFrom: false })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || body.year == null || body.month == null || body.text === undefined) {
    return NextResponse.json({ error: 'year, month and text are required' }, { status: 400 })
  }
  const year = Number(body.year)
  const month = Number(body.month)
  const text = String(body.text)
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const isRecurring = !!body.isRecurring
  const workbookId = String(body.workbookId)

  const note = await db.note.upsert({
    where: { workbookId_year_month: { workbookId, year, month } },
    update: { text, user, isRecurring },
    create: { workbookId, year, month, text, user, isRecurring },
  })
  return NextResponse.json({ ok: true, note })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || body.year == null || body.month == null) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 })
  }
  const year = Number(body.year)
  const month = Number(body.month)
  const workbookId = String(body.workbookId)
  await db.note.deleteMany({ where: { year, month, workbookId } })
  return NextResponse.json({ ok: true })
}
