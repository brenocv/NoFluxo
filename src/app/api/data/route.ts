import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/data  -> returns the full app state in one round-trip.
// The frontend uses this on first load; subsequent updates arrive via socket.
export async function GET() {
  const [categories, transactions, configRows, activity] = await Promise.all([
    db.category.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }),
    db.transaction.findMany(),
    db.config.findMany(),
    db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value

  return NextResponse.json({
    categories,
    transactions,
    config,
    activity,
    year: Number(config.year ?? new Date().getFullYear()),
  })
}
