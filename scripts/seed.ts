// Seed script: reads /home/z/my-project/upload/Porto 2026.xlsx (sheet "Despesas")
// and imports categories + transactions for the 12 months of 2026.
//
// Run with: bun run /home/z/my-project/scripts/seed.ts

import { PrismaClient } from '@prisma/client'
import { load_workbook } from './xlsx_loader'

const db = new PrismaClient()

// ---- helpers --------------------------------------------------------------

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// Try to parse a numeric value from a cell. Returns null if it's a formula
// (we'll compute manually for the few formula-driven categories we care about),
// a string like "x", or empty.
function numOrNull(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    if (v.trim() === '' || v.trim().toLowerCase() === 'x') return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }
  return null
}

// ---- main -----------------------------------------------------------------

async function main() {
  console.log('Loading workbook...')
  const wb = load_workbook('/home/z/my-project/upload/Porto 2026.xlsx')
  const ws = wb['Despesas']
  if (!ws) throw new Error('Sheet "Despesas" not found')

  // Reset DB
  console.log('Cleaning database...')
  await db.activityLog.deleteMany()
  await db.transaction.deleteMany()
  await db.category.deleteMany()
  await db.config.deleteMany()

  // --- exchange rate from A4 ---
  // The sheet stores "Euro" rate in column A, rows 4 (Despesas sheet uses 6.4)
  // We'll fall back to 6.4 if not found.
  let euroRate = 6.4
  const a4 = ws['A4']
  if (a4 && typeof a4.v === 'number') euroRate = a4.v
  await db.config.create({
    data: { key: 'euroToBrl', value: String(euroRate) },
  })
  await db.config.create({
    data: { key: 'year', value: '2026' },
  })
  console.log(`Euro rate set to ${euroRate}`)

  // ---- Category definitions (matching the spreadsheet layout) ----
  // Each entry maps to a row in the sheet. We'll read columns D..O (months 1..12)
  // Note: spreadsheet columns are 1-indexed: A=1,B=2,C=3,D=4 (Jan) ... O=15 (Dec)
  // So month m -> column index 3 + m (1-indexed), or letter from chr(68 + m - 1)
  const cellLetter = (m: number) => String.fromCharCode(67 + m) // Jan=D(68), so m=1 -> 'D'

  interface CatDef {
    name: string
    group: string
    type: 'EXPENSE' | 'INCOME' | 'RESERVE'
    currency: 'BRL' | 'EUR'
    note?: string
    row: number // spreadsheet row
    autoConvert?: boolean // Lazer: value = qty * euroRate
    autoConvertQty?: number
  }

  const categories: CatDef[] = [
    // ---- Despesas (group "despesas") ----
    { name: 'Lazer', group: 'despesas', type: 'EXPENSE', currency: 'BRL', row: 4, autoConvert: true, autoConvertQty: 250 },
    { name: 'Nubank Kiki', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 11', row: 5 },
    { name: 'Nubank Breno', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 5', row: 6 },
    { name: 'Santander Kiki', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 12', row: 7 },
    { name: 'Picpay Breno', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 10', row: 8 },
    { name: 'Inter Kiki', group: 'despesas', type: 'EXPENSE', currency: 'BRL', row: 9 },
    { name: 'Empréstimo Nubank Breno', group: 'despesas', type: 'EXPENSE', currency: 'BRL', row: 10 },
    { name: 'MEI Breno', group: 'despesas', type: 'EXPENSE', currency: 'BRL', row: 12 },
    { name: 'FIES', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'dez 35', row: 13 },
    { name: 'Diogo', group: 'despesas', type: 'EXPENSE', currency: 'BRL', note: 'dez 29', row: 14 },

    // ---- Rendimentos BRL (group "rendimentos_brl") ----
    { name: 'Cheque especial Kiki', group: 'rendimentos_brl', type: 'INCOME', currency: 'BRL', row: 21 },
    { name: 'Caixinha Breno', group: 'rendimentos_brl', type: 'INCOME', currency: 'BRL', row: 22 },
    { name: 'Salário Breno', group: 'rendimentos_brl', type: 'INCOME', currency: 'BRL', row: 24 },

    // ---- Rendimentos EUR (group "rendimentos_eur") ----
    { name: 'Rendimentos Porto', group: 'rendimentos_eur', type: 'INCOME', currency: 'EUR', note: 'Salário + extras', row: 31 },

    // ---- Reservas (group "reservas") ----
    { name: 'Reserva casa', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 15 },
    { name: 'Reserva viagem', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 16 },
    { name: 'Fundo desenvolvimento pessoal', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 17 },

    // ---- Contas casa (group "contas_casa") ----
    { name: 'Aluguel', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', row: 34 },
    { name: 'Luz Endesa', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', row: 35 },
    { name: 'TV, Net, Celular', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', note: 'dia 5 - débito direto', row: 36 },
    { name: 'Supermercado', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', row: 37 },
    { name: 'Transporte Andante', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', row: 38 },
    { name: 'Água', group: 'contas_casa', type: 'EXPENSE', currency: 'EUR', row: 40 },
  ]

  // ---- Create categories and read monthly values ----
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    const created = await db.category.create({
      data: {
        name: c.name,
        group: c.group,
        type: c.type,
        currency: c.currency,
        note: c.note ?? null,
        sortOrder: i,
        autoConvert: !!c.autoConvert,
      },
    })

    for (const m of MONTHS) {
      let value: number | null = null

      if (c.autoConvert && c.autoConvertQty) {
        // Lazer row uses different quantities per month in Despesas:
        // Jan-Jul: 250, Aug-Dec: 200 (per the formulas in the sheet)
        const qty = m <= 7 ? c.autoConvertQty : 200
        value = qty * euroRate
      } else {
        const col = cellLetter(m)
        const cellRef = `${col}${c.row}`
        const cell = ws[cellRef]
        if (cell) {
          value = numOrNull(cell.v)
          // Skip formula-driven cells (we'll compute Saldo manually)
          if (cell.f) value = null
        }
      }

      if (value !== null) {
        await db.transaction.create({
          data: {
            categoryId: created.id,
            year: 2026,
            month: m,
            value,
          },
        })
      }
    }
    console.log(`Imported category: ${c.name}`)
  }

  // Initial activity log entry
  await db.activityLog.create({
    data: {
      user: 'Sistema',
      action: 'create',
      entity: 'config',
      detail: `Importado da planilha "Porto 2026.xlsx" (Euro = R$ ${euroRate})`,
    },
  })

  console.log('Seed completed successfully.')
  const txCount = await db.transaction.count()
  const catCount = await db.category.count()
  console.log(`Categories: ${catCount}, Transactions: ${txCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
