import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/transactions
//   body: {
//     categoryId, month, year?, value, note?, user,
//     isRecurring?, installmentsTotal?  // recurrence fields
//   }
//
// If isRecurring is true:
//   - Generate a seriesId
//   - Create transactions for multiple months:
//     * If installmentsTotal is set (e.g. 8): create N transactions starting at `month`
//     * If installmentsTotal is null (infinite): create from `month` to December
//   - Each transaction gets isRecurring=true, same seriesId, installmentNumber, installmentsTotal
//
// If isRecurring is false (default): single transaction (create/update/delete as before).
//   - If value is null, delete the transaction (and if it was recurring, delete future siblings).
//
// Returns the list of affected transactions.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.categoryId || !body.month) {
    return NextResponse.json({ error: 'categoryId and month are required' }, { status: 400 })
  }

  const categoryId = String(body.categoryId)
  const month = Number(body.month)
  const year = Number(body.year ?? 2026)
  const value = body.value === null || body.value === undefined || body.value === ''
    ? null
    : Number(body.value)
  const note = body.note ? String(body.note) : null
  const user = String(body.user || 'Anônimo').slice(0, 30)

  const isRecurring = !!body.isRecurring
  const installmentsTotal = body.installmentsTotal
    ? Number(body.installmentsTotal)
    : null

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 })
  }
  if (value !== null && isNaN(value)) {
    return NextResponse.json({ error: 'value must be a number or null' }, { status: 400 })
  }
  if (installmentsTotal !== null && (isNaN(installmentsTotal) || installmentsTotal < 1)) {
    return NextResponse.json({ error: 'installmentsTotal must be >= 1' }, { status: 400 })
  }

  const category = await db.category.findUnique({ where: { id: categoryId } })
  if (!category) {
    return NextResponse.json({ error: 'category not found' }, { status: 404 })
  }

  const monthName = MONTHS_PT[month - 1]

  // ---- Case 1: Recurring transaction ----
  if (isRecurring && value !== null) {
    const seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const created: any[] = []

    // Determine the range of months
    let endMonth: number
    if (installmentsTotal !== null) {
      endMonth = Math.min(12, month + installmentsTotal - 1)
    } else {
      endMonth = 12
    }
    const totalToCreate = endMonth - month + 1
    const actualTotal = installmentsTotal !== null ? Math.min(installmentsTotal, totalToCreate) : null

    for (let m = month; m <= endMonth; m++) {
      const installmentNumber = m - month + 1
      // Check if a transaction already exists for this month
      const existing = await db.transaction.findUnique({
        where: { categoryId_year_month: { categoryId, year, month: m } },
      })
      if (existing) {
        // Update the existing one to join the series
        const updated = await db.transaction.update({
          where: { id: existing.id },
          data: { value, note, isRecurring: true, seriesId, installmentNumber, installmentsTotal: actualTotal },
        })
        created.push(updated)
      } else {
        const tx = await db.transaction.create({
          data: {
            categoryId, year, month: m, value, note,
            isRecurring: true, seriesId, installmentNumber,
            installmentsTotal: actualTotal,
          },
        })
        created.push(tx)
      }
    }

    await db.activityLog.create({
      data: {
        user, action: 'create', entity: 'transaction',
        detail: `Criou lançamento recorrente "${category.name}" • ${monthName}-${MONTHS_PT[endMonth - 1]}/2026 • ${formatMoney(value, category.currency)}${actualTotal ? ` (${actualTotal}x)` : ''}`,
      },
    })

    return NextResponse.json({ ok: true, action: 'create', transactions: created, category })
  }

  // ---- Case 2: Single transaction (non-recurring) ----
  let result: any
  let action: 'create' | 'update' | 'delete'
  const existing = await db.transaction.findUnique({
    where: { categoryId_year_month: { categoryId, year, month } },
  })

  if (value === null) {
    // Delete
    if (existing) {
      // If this was a recurring transaction, also delete future siblings in the series
      if (existing.seriesId) {
        await db.transaction.deleteMany({
          where: {
            seriesId: existing.seriesId,
            OR: [
              { month: { gt: month } },
              { id: existing.id },
            ],
          },
        })
      } else {
        await db.transaction.delete({ where: { id: existing.id } })
      }
      result = null
      action = 'delete'
    } else {
      return NextResponse.json({ ok: true, action: 'noop', transaction: null })
    }
  } else {
    // Create or update (strip recurrence fields if editing an existing recurring one)
    if (existing) {
      result = await db.transaction.update({
        where: { id: existing.id },
        data: {
          value, note,
          // If the user is editing a single recurring installment, detach it from the series
          isRecurring: false,
          seriesId: null,
          installmentNumber: null,
          installmentsTotal: null,
        },
      })
      action = 'update'
    } else {
      result = await db.transaction.create({
        data: { categoryId, year, month, value, note },
      })
      action = 'create'
    }
  }

  await db.activityLog.create({
    data: {
      user, action, entity: 'transaction',
      detail: `${action === 'delete' ? 'Removeu' : action === 'create' ? 'Adicionou' : 'Atualizou'} ${category.name} • ${monthName}/${year}${value !== null ? ` • ${formatMoney(value, category.currency)}` : ''}`,
    },
  })

  return NextResponse.json({ ok: true, action, transaction: result, category })
}

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function formatMoney(v: number, currency: 'BRL' | 'EUR') {
  if (currency === 'BRL') return `R$ ${v.toFixed(2)}`
  return `€ ${v.toFixed(2)}`
}
