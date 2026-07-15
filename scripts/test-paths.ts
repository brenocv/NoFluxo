// Quick test to verify collectAllPaths includes categories
import { collectAllPaths } from './src/lib/finance'

const subgroups = [
  { id: '1', key: 'despesas.cartoes', parentKey: 'despesas', name: 'Cartões BR', sortOrder: 0, workbookId: 'wb1' },
  { id: '2', key: 'despesas.contas_casa', parentKey: 'despesas', name: 'Contas casa', sortOrder: 1, workbookId: 'wb1' },
]
const topGroups = [
  { id: 't1', key: 'despesas', name: 'Despesas', color: '#dc2626', sortOrder: 0, type: 'EXPENSE', isDefault: true, workbookId: 'wb1' },
]
const categories = [
  { id: 'c1', name: 'Nubank Breno', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', sortOrder: 0, parentCategoryId: null, workbookId: 'wb1', note: null, color: null, monthlyGoal: null, excludeFromTotal: false, autoConvert: false },
  { id: 'c2', name: 'Comercio', group: 'despesas.cartoes', type: 'EXPENSE', currency: 'BRL', sortOrder: 0, parentCategoryId: 'c1', workbookId: 'wb1', note: null, color: null, monthlyGoal: null, excludeFromTotal: false, autoConvert: false },
]

const result = collectAllPaths(subgroups as any, {}, topGroups as any, categories as any)
for (const r of result) {
  console.log(`${'  '.repeat(r.depth)}[${r.value}] ${r.label}`)
}
