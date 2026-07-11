// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers'da node:fs moduli to'liq ishlamaydi (fs.readdir yo'q).
// Prisma'ning binaryTarget detection logic'i fs.readdir chaqiradi.
//
// Yechim: next.config.ts'da fs va node:fs importlari src/lib/fs-polyfill-module.ts
// ga alias qilingan. Bu fake fs module bo'sh javoblar qaytaradi.
// Prisma driver adapter ishlatganda engine kerak emas - bu safe.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || ''
  const tidbServerlessUrl = process.env.TIDB_DATABASE_URL

  const url = tidbServerlessUrl || databaseUrl
  if (!url || !url.startsWith('mysql://')) {
    throw new Error(
      '[db] TiDB connection URL topilmadi. TIDB_DATABASE_URL yoki DATABASE_URL ' +
      '(mysql:// formatida) o\'rnatilishi kerak.'
    )
  }

  try {
    const adapter = new PrismaTiDBCloud({ url })
    return new PrismaClient({ adapter })
  } catch (err) {
    console.error('[db] TiDB serverless adapter ishga tushmadi:', err)
    throw err
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
