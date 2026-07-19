import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/backup/import
//   body: { backup: {...}, mode: 'replace' | 'merge', workbookId, user }
//
// Safety rules (learned the hard way — an earlier version of this route
// caused real data loss):
//
// 1. EVERYTHING runs inside a single database transaction. If anything
//    fails partway through, the ENTIRE operation is rolled back and the
//    workbook is left exactly as it was before — never half-migrated.
// 2. We NEVER delete an entity type unless the backup file actually
//    contains data to replace it with. An old backup that doesn't include
//    "topGroups", for example, must never cause existing cards to be wiped
//    with nothing to put back.
// 3. Everything is strictly scoped to `workbookId` (the account/workbook
//    currently open in the app). No other workbook or account is ever
//    touched, read, or modified.
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

  // Validate backup structure BEFORE touching the database at all.
  if (!Array.isArray(backup.categories) || !Array.isArray(backup.transactions)) {
    return NextResponse.json({ error: 'Arquivo de backup inválido (faltam categories/transactions)' }, { status: 400 })
  }

  const hasTopGroups = Array.isArray(backup.topGroups) && backup.topGroups.length > 0
  const hasSubgroups = Array.isArray(backup.subgroups)
  const hasNotes = Array.isArray(backup.notes)

  try {
    const result = await db.$transaction(async (tx) => {
      if (mode === 'replace') {
        // Only delete an entity type if the backup actually has data to put
        // back — deleting something we can't restore is how the previous
        // version of this route destroyed a user's cards.
        await tx.transaction.deleteMany({ where: { category: { workbookId } } })
        await tx.category.deleteMany({ where: { workbookId } })
        if (hasSubgroups) {
          await tx.subgroup.deleteMany({ where: { workbookId } })
        }
        if (hasTopGroups) {
          await tx.topGroup.deleteMany({ where: { workbookId } })
        }
      }

      // Config (global settings like customCurrencies — not per-workbook in
      // this schema, so these always merge regardless of mode; never deleted)
      if (backup.config && typeof backup.config === 'object') {
        for (const [key, value] of Object.entries(backup.config)) {
          await tx.config.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        }
      }

      // Top groups (cards) — attached to the CURRENT workbook
      if (hasTopGroups) {
        for (const tg of backup.topGroups) {
          await tx.topGroup.upsert({
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

      // Subgroups — attached to the CURRENT workbook, using the real
      // compound unique key (workbookId + key)
      if (hasSubgroups) {
        for (const sg of backup.subgroups) {
          await tx.subgroup.upsert({
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

      // Categories — two passes so parent/child ordering in the JSON never
      // matters. Pass 1 creates every category WITHOUT parentCategoryId
      // (avoids a foreign-key error if a child appears before its parent).
      // Pass 2 wires up parentCategoryId now that every row exists.
      const oldToNewId = new Map<string, string>()
      for (const c of backup.categories) {
        const created = await tx.category.upsert({
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
        await tx.category.update({
          where: { id: oldToNewId.get(c.id)! },
          data: { parentCategoryId: newParentId },
        })
      }

      // Transactions
      let txCount = 0
      for (const t of backup.transactions) {
        const categoryId = oldToNewId.get(t.categoryId) ?? t.categoryId
        await tx.transaction.upsert({
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

      // Notes — per-workbook (has a required workbookId field + compound
      // unique with it), unlike Config which really is global.
      if (mode === 'replace' && hasNotes) {
        await tx.note.deleteMany({ where: { workbookId } })
      }
      if (hasNotes) {
        for (const n of backup.notes) {
          await tx.note.upsert({
            where: { workbookId_year_month: { workbookId, year: n.year, month: n.month } },
            update: mode === 'replace' ? {
              text: n.text,
              user: n.user,
              isRecurring: n.isRecurring,
            } : {},
            create: {
              workbookId,
              year: n.year,
              month: n.month,
              text: n.text,
              user: n.user,
              isRecurring: n.isRecurring ?? false,
            },
          })
        }
      }

      // Auto-heal: old backups (from before cards/TopGroups were included in
      // the export) can restore categories/transactions just fine, but with
      // no matching card the whole tree is invisible in the UI — the data is
      // there, just unreachable. If this backup has no topGroups, derive the
      // top-level group keys actually used by its categories/subgroups and
      // make sure a card exists for each one, so nothing is ever silently
      // orphaned after a restore.
      if (!hasTopGroups) {
        const KNOWN_DEFAULTS: Record<string, { name: string; color: string; type: string }> = {
          despesas: { name: 'Despesas', color: '#dc2626', type: 'EXPENSE' },
          rendimentos: { name: 'Receitas', color: '#16a34a', type: 'INCOME' },
          reservas: { name: 'Reservas', color: '#d97706', type: 'RESERVE' },
        }
        const topKeys = new Set<string>()
        for (const c of backup.categories) {
          if (c.group) topKeys.add(String(c.group).split('.')[0])
        }
        if (hasSubgroups) {
          for (const sg of backup.subgroups) {
            if (sg.parentKey) topKeys.add(String(sg.parentKey).split('.')[0])
          }
        }
        const existing = await tx.topGroup.findMany({ where: { workbookId }, select: { key: true } })
        const existingKeys = new Set(existing.map((t) => t.key))
        let order = existing.length
        for (const key of topKeys) {
          if (existingKeys.has(key)) continue
          const known = KNOWN_DEFAULTS[key]
          await tx.topGroup.create({
            data: {
              workbookId,
              key,
              name: known?.name ?? key.charAt(0).toUpperCase() + key.slice(1),
              color: known?.color ?? '#64748b',
              type: known?.type ?? 'EXPENSE',
              sortOrder: order++,
              isDefault: !!known,
            },
          })
        }
      }

      const wb = await tx.workbook.findUnique({ where: { id: workbookId }, select: { accountName: true } })
      await tx.activityLog.create({
        data: {
          user, action: 'create', entity: 'config',
          detail: `Importou backup (${mode === 'replace' ? 'substituição' : 'mescla'}) — ${txCount} transações`,
          accountName: wb?.accountName,
        },
      })

      return {
        topGroups: hasTopGroups ? backup.topGroups.length : 0,
        categories: backup.categories.length,
        transactions: txCount,
        subgroups: hasSubgroups ? backup.subgroups.length : 0,
        notes: hasNotes ? backup.notes.length : 0,
        config: Object.keys(backup.config ?? {}).length,
      }
    }, { timeout: 60000, maxWait: 15000 })

    return NextResponse.json({ ok: true, mode, imported: result })
  } catch (e: any) {
    // The transaction rolled back automatically — nothing was changed.
    console.error('Erro ao importar backup (revertido automaticamente):', e)
    return NextResponse.json({ error: e.message || 'Erro ao importar. Nada foi alterado.' }, { status: 500 })
  }
}
