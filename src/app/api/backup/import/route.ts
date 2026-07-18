import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/backup/import
//   body: { backup: {...}, mode: 'replace' | 'merge', workbookId, user }
//
// mode='replace': deletes this workbook's existing cards/categories/subgroups/
//                 transactions and restores from backup.
// mode='merge':   keeps existing data, adds only what's missing (by ID).
//
// Everything imported is attached to `workbookId` (the workbook currently
// open in the app) — NOT whatever workbookId happens to be embedded in the
// backup file, since you're usually restoring into whichever workbook you
// have open right now, possibly a brand new one.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.backup) {
    return NextResponse.json({ error: 'backup object is required' }, { status: 400 })
  }

  const backup = body.backup
  const mode: 'replace' | 'merge' = body.mode === 'merge' ? 'merge' : 'replace'
  const user = String(body.user || 'Anônimo').slice(0, 30)
  const workbookId = body.workbookId ? String(body.workbookId) : undefined

  if (!workbookId) {
    return NextResponse.json({ error: 'workbookId is required' }, { status: 400 })
  }

  // Validate backup structure
  if (!Array.isArray(backup.categories) || !Array.isArray(backup.transactions)) {
    return NextResponse.json({ error: 'Arquivo de backup inválido (faltam categories/transactions)' }, { status: 400 })
  }

  try {
    if (mode === 'replace') {
      // Delete only THIS workbook's data — never touch other workbooks/accounts.
      await db.transaction.deleteMany({ where: { category: { workbookId } } })
      await db.category.deleteMany({ where: { workbookId } })
      await db.subgroup.deleteMany({ where: { workbookId } })
      await db.topGroup.deleteMany({ where: { workbookId } })
    }

    // Import config (global settings like customCurrencies — not per-workbook
    // in this schema, so these always merge regardless of mode)
    if (backup.config && typeof backup.config === 'object') {
      for (const [key, value] of Object.entries(backup.config)) {
        await db.config.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      }
    }

    // Import top groups (cards) — attached to the CURRENT workbook
    if (Array.isArray(backup.topGroups)) {
      for (const tg of backup.topGroups) {
        await db.topGroup.upsert({
          where: { workbookId_key: { workbookId, key: tg.key } },
          update: mode === 'replace' ? {
            name: tg.name,
            color: tg.color,
            sortOrder: tg.sortOrder,
            type: tg.type,
            isDefault: tg.isDefault,
          } : {},
          create: {
            workbookId,
            key: tg.key,
            name: tg.name,
            color: tg.color,
            sortOrder: tg.sortOrder ?? 0,
            type: tg.type ?? 'EXPENSE',
            isDefault: tg.isDefault ?? false,
          },
        })
      }
    }

    // Import subgroups — attached to the CURRENT workbook. Uses the real
    // compound unique key (workbookId + key), not "key" alone (which isn't
    // unique on its own and was silently failing every restore before).
    if (Array.isArray(backup.subgroups)) {
      for (const sg of backup.subgroups) {
        await db.subgroup.upsert({
          where: { workbookId_key: { workbookId, key: sg.key } },
          update: mode === 'replace' ? {
            parentKey: sg.parentKey,
            name: sg.name,
            sortOrder: sg.sortOrder,
          } : {},
          create: {
            workbookId,
            key: sg.key,
            parentKey: sg.parentKey,
            name: sg.name,
            sortOrder: sg.sortOrder ?? 0,
          },
        })
      }
    }

    // Import categories — two passes so parent/child ordering in the JSON
    // never matters. Pass 1 creates every category WITHOUT parentCategoryId
    // (avoids a foreign-key error if a child appears before its parent in the
    // array — this was the other cause of restores failing outright). Pass 2
    // then wires up parentCategoryId now that every row exists.
    const oldToNewId = new Map<string, string>()
    for (const c of backup.categories) {
      const created = await db.category.upsert({
        where: { id: c.id },
        update: mode === 'replace' ? {
          workbookId,
          name: c.name,
          group: c.group,
          type: c.type,
          currency: c.currency,
          color: c.color,
          note: c.note,
          sortOrder: c.sortOrder,
          autoConvert: c.autoConvert,
          excludeFromTotal: c.excludeFromTotal,
          monthlyGoal: c.monthlyGoal,
          parentCategoryId: null,
        } : {},
        create: {
          id: c.id,
          workbookId,
          name: c.name,
          group: c.group,
          type: c.type,
          currency: c.currency,
          color: c.color,
          note: c.note,
          sortOrder: c.sortOrder ?? 0,
          autoConvert: c.autoConvert ?? false,
          excludeFromTotal: c.excludeFromTotal ?? false,
          monthlyGoal: c.monthlyGoal ?? null,
          parentCategoryId: null,
        },
      })
      oldToNewId.set(c.id, created.id)
    }
    for (const c of backup.categories) {
      if (!c.parentCategoryId) continue
      const newParentId = oldToNewId.get(c.parentCategoryId)
      if (!newParentId) continue
      await db.category.update({
        where: { id: oldToNewId.get(c.id)! },
        data: { parentCategoryId: newParentId },
      })
    }

    // Import transactions
    let txCount = 0
    if (Array.isArray(backup.transactions)) {
      for (const t of backup.transactions) {
        const categoryId = oldToNewId.get(t.categoryId) ?? t.categoryId
        await db.transaction.upsert({
          where: { categoryId_year_month: { categoryId, year: t.year, month: t.month } },
          update: mode === 'replace' ? {
            value: t.value,
            note: t.note,
            isRecurring: t.isRecurring,
            seriesId: t.seriesId,
            installmentNumber: t.installmentNumber,
            installmentsTotal: t.installmentsTotal,
          } : {},
          create: {
            categoryId,
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

    // Import notes (global, like config — not per-workbook in this schema)
    if (Array.isArray(backup.notes)) {
      for (const n of backup.notes) {
        await db.note.upsert({
          where: { year_month: { year: n.year, month: n.month } },
          update: mode === 'replace' ? {
            text: n.text,
            user: n.user,
            isRecurring: n.isRecurring,
          } : {},
          create: {
            year: n.year,
            month: n.month,
            text: n.text,
            user: n.user,
            isRecurring: n.isRecurring ?? false,
          },
        })
      }
    }

    const wb = await db.workbook.findUnique({ where: { id: workbookId }, select: { accountName: true } })
    await db.activityLog.create({
      data: {
        user, action: 'create', entity: 'config',
        detail: `Importou backup (${mode === 'replace' ? 'substituição' : 'mescla'}) — ${txCount} transações`,
        accountName: wb?.accountName,
      },
    })

    return NextResponse.json({
      ok: true,
      mode,
      imported: {
        topGroups: backup.topGroups?.length ?? 0,
        categories: backup.categories?.length ?? 0,
        transactions: txCount,
        subgroups: backup.subgroups?.length ?? 0,
        notes: backup.notes?.length ?? 0,
        config: Object.keys(backup.config ?? {}).length,
      },
    })
  } catch (e: any) {
    console.error('Erro ao importar backup:', e)
    return NextResponse.json({ error: e.message || 'Erro ao importar' }, { status: 500 })
  }
}
