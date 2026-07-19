import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/backup?workbookId=xxx -> returns a JSON file with this workbook's
// full data (all years). If workbookId is omitted, exports everything
// (legacy/admin use only — not used by the normal in-app "Backup" button).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workbookId = url.searchParams.get('workbookId') ?? undefined

  const [topGroups, categories, subgroups, transactions, configRows, notes, activityLogs] = await Promise.all([
    db.topGroup.findMany({ where: workbookId ? { workbookId } : {} }),
    db.category.findMany({ where: workbookId ? { workbookId } : {} }),
    db.subgroup.findMany({ where: workbookId ? { workbookId } : {} }),
    db.transaction.findMany({
      where: workbookId ? { category: { workbookId } } : {},
    }),
    db.config.findMany(),
    db.note.findMany({ where: workbookId ? { workbookId } : {} }),
    db.activityLog.findMany(),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    workbookId: workbookId ?? null,
    topGroups,
    categories,
    subgroups,
    transactions,
    notes,
    activityLogs,
    config,
  }

  const json = JSON.stringify(backup, null, 2)

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nofluxo-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
