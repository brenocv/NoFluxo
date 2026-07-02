import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/data?year=2026 -> returns the full app state for the given year.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026

  const [categories, transactions, configRows, activity, subgroups] = await Promise.all([
    db.category.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }),
    // Only return transactions for the requested year (plus recurring series
    // that START in or before this year, so the UI can show badges).
    db.transaction.findMany({ where: { year } }),
    db.config.findMany(),
    db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    db.subgroup.findMany({ orderBy: [{ parentKey: 'asc' }, { sortOrder: 'asc' }] }),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value

  let labels: Record<string, string> = {}
  try { labels = JSON.parse(config.labels ?? '{}') } catch {}

  return NextResponse.json({
    categories,
    transactions,
    config,
    labels,
    activity,
    subgroups,
    year,
  })
}
