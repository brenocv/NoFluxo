// Seed script: reads /home/z/my-project/upload/Porto 2026.xlsx (sheet "Despesas")
// and imports categories + transactions for the 12 months of 2026.

import { PrismaClient } from '@prisma/client'
import { load_workbook } from './xlsx_loader'

const db = new PrismaClient()

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

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

async function main() {
  console.log('Loading workbook...')
  const wb = load_workbook('/home/z/my-project/upload/Porto 2026.xlsx')
  const ws = wb['Despesas']
  if (!ws) throw new Error('Sheet "Despesas" not found')

  console.log('Cleaning database...')
  await db.activityLog.deleteMany()
  await db.transaction.deleteMany()
  await db.category.deleteMany()
  await db.config.deleteMany()

  const euroRate = 6
  await db.config.create({ data: { key: 'euroToBrl', value: String(euroRate) } })
  await db.config.create({ data: { key: 'year', value: '2026' } })
  // Default labels (empty — user can override via UI)
  await db.config.create({ data: { key: 'labels', value: '{}' } })
  console.log(`Euro rate set to ${euroRate}`)

  const cellLetter = (m: number) => String.fromCharCode(67 + m)

  interface CatDef {
    name: string
    group: string
    type: 'EXPENSE' | 'INCOME' | 'RESERVE'
    currency: 'BRL' | 'EUR'
    note?: string
    row: number
    autoConvert?: boolean
    autoConvertQty?: number
    excludeFromTotal?: boolean
  }

  const categories: CatDef[] = [
    // ---- Despesas > Cartões BR ----
    { name: 'Lazer', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', row: 4, autoConvert: true, autoConvertQty: 250 },
    { name: 'Nubank Kiki', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 11', row: 5 },
    { name: 'Nubank Breno', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 5', row: 6 },
    { name: 'Santander Kiki', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 12', row: 7 },
    { name: 'Picpay Breno', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'vence dia 10', row: 8 },
    { name: 'Inter Kiki', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', row: 9 },
    { name: 'Empréstimo Nubank Breno', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', row: 10 },
    { name: 'MEI Breno', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', row: 12 },
    { name: 'FIES', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'dez 35', row: 13 },
    { name: 'Diogo', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', note: 'dez 29', row: 14 },

    // ---- Despesas > Contas casa ----
    { name: 'Aluguel', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 34 },
    { name: 'Luz Endesa', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 35 },
    { name: 'TV, Net, Celular', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', note: 'dia 5 - débito direto', row: 36 },
    { name: 'Supermercado', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 37 },
    { name: 'Transporte Andante', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 38 },
    { name: 'Água', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 40 },
    { name: 'Plano Tetê e Limão', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 42 },
    { name: 'Turminha rações', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 43 },
    { name: 'Mesada Kiki', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 44 },
    { name: 'Mesada Breno', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', row: 45 },
    { name: 'Wizink', group: 'despesas.contas_casa', type: 'EXPENSE', currency: 'EUR', note: 'dia 11', row: 46 },

    // ---- Rendimentos > Em Real (R$) ----
    { name: 'Cheque especial Kiki', group: 'rendimentos.brl', type: 'INCOME', currency: 'BRL', row: 21 },
    { name: 'Salário Breno', group: 'rendimentos.brl', type: 'INCOME', currency: 'BRL', row: 24 },

    // ---- Rendimentos > Em Euro (€) ----
    { name: 'Rendimentos Porto', group: 'rendimentos.eur', type: 'INCOME', currency: 'EUR', note: 'Salário + extras', row: 31 },

    // ---- Rendimentos > Valores a receber ----
    {
      name: 'Caixinha Breno',
      group: 'rendimentos.valores_a_receber',
      type: 'INCOME',
      currency: 'BRL',
      row: 22,
      excludeFromTotal: true,
    },

    // ---- Reservas ----
    { name: 'Reserva casa', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 15 },
    { name: 'Reserva viagem', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 16 },
    { name: 'Fundo desenvolvimento pessoal', group: 'reservas', type: 'RESERVE', currency: 'BRL', row: 17 },
  ]

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
        excludeFromTotal: !!c.excludeFromTotal,
      },
    })

    for (const m of MONTHS) {
      let value: number | null = null
      if (c.autoConvert && c.autoConvertQty) {
        const qty = m <= 7 ? c.autoConvertQty : 200
        value = qty * euroRate
      } else {
        const col = cellLetter(m)
        const cell = ws[`${col}${c.row}`]
        if (cell) {
          value = numOrNull(cell.v)
          if (cell.f) value = null
        }
      }
      if (value !== null) {
        await db.transaction.create({
          data: { categoryId: created.id, year: 2026, month: m, value },
        })
      }
    }
    console.log(`Imported: ${c.name} -> ${c.group}`)
  }

  await db.activityLog.create({
    data: {
      user: 'Sistema',
      action: 'create',
      entity: 'config',
      detail: `Importado da planilha "Porto 2026.xlsx" (Euro = R$ ${euroRate})`,
    },
  })

  console.log('Seed completed.')
  const txCount = await db.transaction.count()
  const catCount = await db.category.count()
  console.log(`Categories: ${catCount}, Transactions: ${txCount}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
