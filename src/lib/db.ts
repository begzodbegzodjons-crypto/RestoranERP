// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// MUHIM: Cloudflare Workers `fs` modulini to'liq qo'llab-quvvatlamaydi.
// Standart `@prisma/client` Prisma engine init qilish paytida `fs.readdir`
// chaqiradi (OpenSSL detection uchun). Driver adapter ishlatilganda engine
// kerak emas, lekin init kod baraban `fs.readdir` ni chaqiradi.
//
// Yechim:
// 1. Standart @prisma/client ishlatamiz (edge variant adapter'ni qo'llamaydi)
// 2. wrangler.jsonc'da nodejs_compat_v2 flag (Cloudflare'ning yangi Node.js
//    compat layeri - fs.readdir stub sifatida ishlaydi)
// 3. Bu faylda global polyfill qo'shamiz - agar wrangler flag yetarli bo'lmasa

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

// Polyfill: Cloudflare Workers'da fs.readdir ishlashi uchun
// (Prisma engine init kodini chaqiradi, lekin adapter ishlatadi)
if (typeof globalThis.require === 'function') {
  try {
    const fs = globalThis.require('fs')
    if (!fs.readdir) {
      fs.readdir = ((_path: string, cb: any) => cb(null, [])) as any
      fs.readdirSync = ((_path: string) => []) as any
      fs.existsSync = ((_path: string) => false) as any
    }
  } catch {}
}

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
