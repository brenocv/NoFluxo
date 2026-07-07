import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/data?year=2026&workbookId=xxx -> returns the full app state for the given year + workbook.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026
  const workbookId = url.searchParams.get('workbookId') ?? undefined

  const catWhere = workbookId ? { workbookId } : {}
  const subWhere = workbookId ? { workbookId } : {}

  const [categories, transactions, configRows, activity, subgroups] = await Promise.all([
    db.category.findMany({ where: catWhere, orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }),
    db.transaction.findMany({
      where: { year, category: workbookId ? { workbookId } : undefined },
    }),
    db.config.findMany(),
    db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    db.subgroup.findMany({ where: subWhere, orderBy: [{ parentKey: 'asc' }, { sortOrder: 'asc' }] }),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value

  // Labels are per-workbook: stored as config key `labels:<workbookId>`
  const labelsKey = workbookId ? `labels:${workbookId}` : 'labels'
  let labels: Record<string, string> = {}
  try { labels = JSON.parse(config[labelsKey] ?? config.labels ?? '{}') } catch {}

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
