// Prisma client - TiDB Cloud + Cloudflare Pages muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers runtime muhitida Prisma Client faqat TiDB adapter
// orqali ishlaydi (TCP yo'q, HTTP fetch orqali).
//
// Muhim: Cloudflare Workers da `fs` moduli to'liq qo'llab-quvvatlanmaydi,
// shuning uchun Prisma Client'ni faqat TIDB_DATABASE_URL mavjud bo'lganda
// initialize qilamiz. Lokal dev uchun SQLite fallback saqlanadi.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || ''
  const tidbServerlessUrl = process.env.TIDB_DATABASE_URL

  // Production (Cloudflare Workers yoki Node.js prod) - TiDB serverless adapter
  // Bu yerda databaseUrl "mysql://..." formatida bo'ladi (file: emas)
  const isTiDB = tidbServerlessUrl ||
    databaseUrl.includes('tidbcloud.com') ||
    databaseUrl.startsWith('mysql://')

  if (isTiDB) {
    const url = tidbServerlessUrl || databaseUrl
    try {
      const adapter = new PrismaTiDBCloud({ url })
      // adapter berilganda Prisma hech qanday engine ishlatmaydi - to'g'ridan-to'g'ri
      // adapter orqali so'rov yuboradi. fs.readdir chaqirilmaydi.
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('[db] TiDB serverless adapter ishga tushmadi:', err)
      throw err
    }
  }

  // Lokal dev (SQLite) - faqat Node.js muhitida ishlaydi
  // Cloudflare Workers bu shoxga tushmaydi
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
