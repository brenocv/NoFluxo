import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/backup -> returns a JSON file with the FULL database (all years)
//   { categories, subgroups, transactions, config, notes, labels }
export async function GET() {
  const [categories, subgroups, transactions, configRows, notes, activityLogs] = await Promise.all([
    db.category.findMany(),
    db.subgroup.findMany(),
    db.transaction.findMany(),
    db.config.findMany(),
    db.note.findMany(),
    db.activityLog.findMany(),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
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
      'Content-Disposition': `attachment; filename="porto-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
