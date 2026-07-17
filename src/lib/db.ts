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

// Resolves the accountName that owns a given workbook, so activity log
// entries can be scoped per account (not just globally). Returns null for
// legacy/shared workbooks with no accountName set, or if workbookId is empty.
export async function getWorkbookAccountName(workbookId: string | null | undefined): Promise<string | null> {
  if (!workbookId) return null
  try {
    const wb = await db.workbook.findUnique({ where: { id: workbookId }, select: { accountName: true } })
    return wb?.accountName ?? null
  } catch {
    return null
  }
}