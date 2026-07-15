import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const c = await db.category.findFirst({ where: { excludeFromTotal: true } })
console.log('Direct Prisma query result:', c)
await db.$disconnect()
