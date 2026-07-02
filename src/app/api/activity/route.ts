import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/activity -> returns the 30 most recent activity log entries
export async function GET() {
  const items = await db.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ items })
}
