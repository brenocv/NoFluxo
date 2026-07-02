import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { getTopGroupLabel, getGroupLabel, GROUP_STRUCTURE, MONTHS_PT } from '@/lib/finance'

// GET /api/export -> returns an .xlsx file with the full year's data,
// structured similarly to the original "Porto 2026.xlsx" spreadsheet.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const euroRate = parseFloat(url.searchParams.get('euroRate') ?? '6') || 6
  const year = parseInt(url.searchParams.get('year') ?? '2026', 10) || 2026

  const [categories, transactions, configRows] = await Promise.all([
    db.category.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }),
    db.transaction.findMany({ where: { year } }),
    db.config.findMany(),
  ])

  const config: Record<string, string> = {}
  for (const c of configRows) config[c.key] = c.value
  let labels: Record<string, string> = {}
  try { labels = JSON.parse(config.labels ?? '{}') } catch {}

  // Build the sheet data
  // Columns: A=euro rate, B=blank, C=Category name, D..O = Jan..Dec, P=Total
  const rows: any[][] = []

  // Header rows
  rows.push(['Euro', '', 'Despesas', ...MONTHS_PT.map((_, i) => new Date(year, i, 1)), 'Total'])
  rows.push([euroRate, '', 'Total geral', ...MONTHS_PT.map(() => ''), ''])

  // Group categories by top-level group, then subgroup
  for (const topDef of GROUP_STRUCTURE) {
    const topKey = topDef.key
    const topLabel = getTopGroupLabel(topKey, labels)

    // If the top-level group has subgroups, render each subgroup
    if (topDef.subgroups.length > 0) {
      for (const subDef of topDef.subgroups) {
        const subLabel = getGroupLabel(subDef.key, labels)
        const cats = categories.filter((c) => c.group === subDef.key)
        if (cats.length === 0) continue

        // Subgroup header row
        rows.push(['', '', `  ${topLabel} > ${subLabel}`, ...MONTHS_PT.map(() => ''), ''])

        for (const cat of cats) {
          const row: any[] = ['', '', cat.name]
          let total = 0
          for (let m = 1; m <= 12; m++) {
            const tx = transactions.find((t) => t.categoryId === cat.id && t.month === m && true)
            if (tx) {
              row.push(tx.value)
              total += tx.value
            } else {
              row.push('')
            }
          }
          row.push(total || '')
          rows.push(row)
        }
      }
    } else {
      // No subgroups — render categories directly
      const cats = categories.filter((c) => c.group === topKey)
      for (const cat of cats) {
        const row: any[] = ['', '', cat.name]
        let total = 0
        for (let m = 1; m <= 12; m++) {
          const tx = transactions.find((t) => t.categoryId === cat.id && t.month === m && true)
          if (tx) {
            row.push(tx.value)
            total += tx.value
          } else {
            row.push('')
          }
        }
        row.push(total || '')
        rows.push(row)
      }
    }
  }

  // Create worksheet and workbook
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 8 },   // A
    { wch: 3 },   // B
    { wch: 35 },  // C
    ...MONTHS_PT.map(() => ({ wch: 10 })), // D..O
    { wch: 12 },  // P
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Porto ${year}`)

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Porto-${year}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
