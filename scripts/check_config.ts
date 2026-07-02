import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const cfg = await db.config.findMany()
console.log(JSON.stringify(cfg, null, 2))
await db.$disconnect()
