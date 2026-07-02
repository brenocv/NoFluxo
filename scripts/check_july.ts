import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const cats = await db.category.findMany({ where: { excludeFromTotal: true } })
console.log('excludeFromTotal categories:', cats.map(c => ({name: c.name, group: c.group})))
for (const c of cats) {
  const txs = await db.transaction.findMany({ where: { categoryId: c.id, month: 7, year: 2026 } })
  console.log(`${c.name} (Jul/2026):`, txs)
}
await db.$disconnect()
