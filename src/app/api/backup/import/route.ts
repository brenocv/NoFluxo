import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/backup/import
//   body: { backup: {...}, mode: 'replace' | 'merge' }
//
//   mode='replace': DELETES all existing data and restores from backup.
//   mode='merge':   keeps existing data, adds only what's missing (by ID).
//
// Returns counts of what was imported.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.backup) {
    return NextResponse.json({ error: 'backup object is required' }, { status: 400 })
  }

  const backup = body.backup
  const mode: 'replace' | 'merge' = body.mode === 'merge' ? 'merge' : 'replace'
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const fallbackWbId: string | undefined = body.workbookId || backup.workbookId || undefined

  // Validate backup structure
  const requiredKeys = ['categories', 'transactions', 'config']
  for (const key of requiredKeys) {
    if (!Array.isArray(backup[key]) && key !== 'config') {
      if (key === 'config' && typeof backup[key] === 'object') continue
      return NextResponse.json({ error: `backup.${key} is missing or invalid` }, { status: 400 })
    }
  }

  try {
    if (mode === 'replace') {
      // Delete everything in the right order (respecting foreign keys)
      await db.activityLog.deleteMany()
      await db.transaction.deleteMany()
      await db.note.deleteMany()
      await db.category.deleteMany()
      await db.subgroup.deleteMany()
      await db.config.deleteMany()
    }

    // Import config
    if (backup.config && typeof backup.config === 'object') {
      for (const [key, value] of Object.entries(backup.config)) {
        await db.config.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      }
    }

    // Import subgroups
    if (Array.isArray(backup.subgroups)) {
      for (const sg of backup.subgroups) {
        const sgWbId = sg.workbookId || fallbackWbId
        if (!sgWbId) continue
        await db.subgroup.upsert({
          where: { id: sg.id },
          update: mode === 'replace' ? {
            workbookId: sgWbId,
            parentKey: sg.parentKey,
            name: sg.name,
            sortOrder: sg.sortOrder,
          } : {},
          create: {
            id: sg.id,
            workbookId: sgWbId,
            key: sg.key,
            parentKey: sg.parentKey,
            name: sg.name,
            sortOrder: sg.sortOrder,
          },
        })
      }
    }

    // Import categories
    if (Array.isArray(backup.categories)) {
      for (const c of backup.categories) {
        const cWbId = c.workbookId || fallbackWbId
        if (!cWbId) continue
        await db.category.upsert({
          where: { id: c.id },
          update: mode === 'replace' ? {
            workbookId: cWbId,
            name: c.name,
            group: c.group,
            type: c.type,
            currency: c.currency,
            note: c.note,
            sortOrder: c.sortOrder,
            autoConvert: c.autoConvert,
            excludeFromTotal: c.excludeFromTotal,
            monthlyGoal: c.monthlyGoal,
            parentCategoryId: c.parentCategoryId,
          } : {},
          create: {
            id: c.id,
            workbookId: cWbId,
            name: c.name,
            group: c.group,
            type: c.type,
            currency: c.currency,
            note: c.note,
            sortOrder: c.sortOrder,
            autoConvert: c.autoConvert,
            excludeFromTotal: c.excludeFromTotal,
            monthlyGoal: c.monthlyGoal,
            parentCategoryId: c.parentCategoryId,
          },
        })
      }
    }

    // Import transactions
    let txCount = 0
    if (Array.isArray(backup.transactions)) {
      for (const t of backup.transactions) {
        await db.transaction.upsert({
          where: { categoryId_year_month: { categoryId: t.categoryId, year: t.year, month: t.month } },
          update: mode === 'replace' ? {
            value: t.value,
            note: t.note,
            isRecurring: t.isRecurring,
            seriesId: t.seriesId,
            installmentNumber: t.installmentNumber,
            installmentsTotal: t.installmentsTotal,
          } : {},
          create: {
            id: t.id,
            categoryId: t.categoryId,
            year: t.year,
            month: t.month,
            value: t.value,
            note: t.note,
            isRecurring: t.isRecurring ?? false,
            seriesId: t.seriesId,
            installmentNumber: t.installmentNumber,
            installmentsTotal: t.installmentsTotal,
          },
        })
        txCount++
      }
    }

    // Import notes
    if (Array.isArray(backup.notes)) {
      for (const n of backup.notes) {
        const nWbId = n.workbookId || fallbackWbId
        if (!nWbId) continue
        try {
          await db.note.upsert({
            where: { workbookId_year_month: { workbookId: nWbId, year: n.year, month: n.month } },
            update: mode === 'replace' ? {
              text: n.text,
              user: n.user,
              isRecurring: n.isRecurring,
            } : {},
            create: {
              id: n.id,
              workbookId: nWbId,
              year: n.year,
              month: n.month,
              text: n.text,
              user: n.user,
              isRecurring: n.isRecurring ?? false,
            },
          })
        } catch {
          // Skip if upsert fails (e.g. ID conflict in merge mode)
        }
      }
    }

    await db.activityLog.create({
      data: {
        user, action: 'create', entity: 'config',
        detail: `Importou backup (${mode === 'replace' ? 'substituição' : 'mescla'}) — ${txCount} transações`,
      },
    })

    return NextResponse.json({
      ok: true,
      mode,
      imported: {
        categories: backup.categories?.length ?? 0,
        transactions: txCount,
        subgroups: backup.subgroups?.length ?? 0,
        notes: backup.notes?.length ?? 0,
        config: Object.keys(backup.config ?? {}).length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao importar' }, { status: 500 })
  }
}
