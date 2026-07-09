import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/import-statement
//   body: { workbookId, year, month, transactions: [{ description, amount, date }] }
//   For each transaction, tries to auto-match a category by name.
//   Returns the transactions with suggested category matches.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.workbookId || !body.transactions) {
    return NextResponse.json({ error: 'workbookId and transactions are required' }, { status: 400 })
  }

  const workbookId = String(body.workbookId)
  const year = Number(body.year ?? 2026)
  const month = Number(body.month ?? 1)
  const user = String(body.user || 'Anônimo').slice(0, 30)

  // Fetch all categories in this workbook for matching
  const categories = await db.category.findMany({ where: { workbookId } })

  // For each imported transaction, try to find a matching category
  const results = body.transactions.map((tx: any) => {
    const description = String(tx.description || '').toLowerCase().trim()
    const amount = Number(tx.amount) || 0

    // Try to match by category name or note
    let matchedCategory: any = null
    let matchScore = 0

    for (const cat of categories) {
      const catName = cat.name.toLowerCase()
      const catNote = (cat.note || '').toLowerCase()

      // Exact name match
      if (description === catName) {
        matchedCategory = cat
        matchScore = 100
        break
      }

      // Description contains category name
      if (description.includes(catName) && catName.length > 3) {
        if (catName.length > matchScore) {
          matchedCategory = cat
          matchScore = catName.length
        }
      }

      // Category note keywords match (e.g. "vence dia 11" -> check for "dia 11")
      if (catNote && description.includes(catNote)) {
        if (catNote.length > matchScore) {
          matchedCategory = cat
          matchScore = catNote.length
        }
      }
    }

    return {
      description: tx.description,
      amount,
      date: tx.date || '',
      suggestedCategoryId: matchedCategory?.id || null,
      suggestedCategoryName: matchedCategory?.name || null,
      matched: !!matchedCategory,
    }
  })

  // Count matches
  const matchedCount = results.filter((r: any) => r.matched).length

  return NextResponse.json({
    ok: true,
    transactions: results,
    matchedCount,
    unmatchedCount: results.length - matchedCount,
    categories: categories.map((c) => ({ id: c.id, name: c.name, group: c.group, type: c.type, currency: c.currency })),
  })
}

// PUT /api/import-statement — actually save the matched transactions
//   body: { workbookId, year, month, user, items: [{ categoryId, amount, description }] }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.workbookId || !body.items) {
    return NextResponse.json({ error: 'workbookId and items are required' }, { status: 400 })
  }

  const workbookId = String(body.workbookId)
  const year = Number(body.year ?? 2026)
  const month = Number(body.month ?? 1)
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const items = body.items as Array<{ categoryId: string; amount: number; description: string }>

  let created = 0
  for (const item of items) {
    if (!item.categoryId) continue

    // Check if a transaction already exists for this category+month
    const existing = await db.transaction.findUnique({
      where: { categoryId_year_month: { categoryId: item.categoryId, year, month } },
    })

    if (existing) {
      // Update existing
      await db.transaction.update({
        where: { id: existing.id },
        data: { value: Math.abs(item.amount), note: item.description?.slice(0, 100) || null },
      })
    } else {
      // Create new
      await db.transaction.create({
        data: {
          categoryId: item.categoryId,
          year, month,
          value: Math.abs(item.amount),
          note: item.description?.slice(0, 100) || null,
        },
      })
    }
    created++
  }

  await db.activityLog.create({
    data: { user, action: 'create', entity: 'transaction', detail: 'Importou ' + created + ' transação(ões) de extrato' },
  })

  return NextResponse.json({ ok: true, created })
}
