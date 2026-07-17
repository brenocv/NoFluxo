import { NextRequest, NextResponse } from 'next/server'
import { db, getWorkbookAccountName } from '@/lib/db'

// GET /api/activity?workbookId=xxx -> returns the 30 most recent activity log
// entries for the account that owns this workbook. Never returns other
// accounts' activity, even though ActivityLog is a single shared table.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workbookId = url.searchParams.get('workbookId') ?? undefined
  const accountName = await getWorkbookAccountName(workbookId)

  const items = await db.activityLog.findMany({
    where: { accountName },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ items })
}
