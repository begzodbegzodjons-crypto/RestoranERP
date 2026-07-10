// Prisma client - TiDB Cloud + Cloudflare Pages muhitga moslashtirilgan
// ============================================================================
// Strategiya:
// 1) Cloudflare Pages (production) -> @tidbcloud/serverless driver +
//    @tidbcloud/prisma-adapter orqali Prisma Client ishlatiladi.
//    Bu TCPsiz HTTP fetch orqali ishlaydi (CF Workers runtime da ishlaydi).
// 2) Lokal dev (SQLite) -> oddiy PrismaClient ishlatiladi.
// 3) Vercel/Node.js prod (PostgreSQL) -> oddiy PrismaClient ishlatiladi.
//
// Environment orqali avtomatik tanlanadi:
//   - process.env.TIDB_DATABASE_URL mavjud bo'lsa      -> TiDB serverless (CF)
//   - process.env.DATABASE_URL "file:" bilan boshlansa -> SQLite (local)
//   - process.env.DATABASE_URL "tidbcloud.com" ni o'z ichrasasa -> TiDB
//   - aks holda                                            -> oddiy PrismaClient

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || ''
  const tidbServerlessUrl = process.env.TIDB_DATABASE_URL

  // === 1. Cloudflare Pages / TiDB Serverless (HTTP driver) ===
  // CF Workers da TCP yo'qligi uchun @tidbcloud/serverless driver ishlatiladi
  // Bu URL `mysql://user:pass@host:4000/db?sslaccept=strict` formatida bo'ladi
  if (tidbServerlessUrl || databaseUrl.includes('tidbcloud.com')) {
    const url = tidbServerlessUrl || databaseUrl
    try {
      const adapter = new PrismaTiDBCloud({ url })
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('[db] TiDB serverless adapter ishga tushmadi:', err)
      throw err
    }
  }

  // === 2. Lokal dev (SQLite) yoki Node.js prod (PostgreSQL) ===
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
