import { PrismaClient } from '@prisma/client'

// Force a fresh client whenever the module is reloaded in dev so we always
// pick up the latest generated Prisma Client (e.g. when a new field is added
// to the schema). In production the global cache is preserved.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVersion?: string
}

const CURRENT_VERSION = 'v7-category-tree'

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })
}

let db: PrismaClient
if (process.env.NODE_ENV === 'production') {
  db = globalForPrisma.prisma ?? createClient()
  if (!globalForPrisma.prisma) globalForPrisma.prisma = db
} else {
  // Dev: recreate if version changed
  if (globalForPrisma.prisma && globalForPrisma.prismaVersion !== CURRENT_VERSION) {
    try { globalForPrisma.prisma.$disconnect() } catch {}
    globalForPrisma.prisma = undefined
  }
  db = globalForPrisma.prisma ?? createClient()
  globalForPrisma.prisma = db
  globalForPrisma.prismaVersion = CURRENT_VERSION
}

export { db }