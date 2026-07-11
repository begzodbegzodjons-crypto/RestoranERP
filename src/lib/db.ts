// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers `nodejs_compat_v2` flag bilan Node.js API'larining
// ko'p qismini qo'llab-quvvatlaydi, lekin ba'zi fs funksiyalari hali ham
// to'liq ishlamasligi mumkin. Prisma Client init paytida fs.readdir
// chaqiradi (OpenSSL detection uchun), shuning uchun polyfill qo'shamiz.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

// Polyfill: fs.readdir/readdirSync/existsSync - Prisma init uchun
// (driver adapter ishlatilganda Prisma engine ishlamaydi, lekin init kod
// baraban fs.readdir chaqiradi - bo'sh array qaytarish kifoya)
declare global {
  // eslint-disable-next-line no-var
  var __fsPolyfilled: boolean | undefined
}

if (!globalThis.__fsPolyfilled) {
  try {
    // node:fs ni polyfill qilish
    const Module = globalThis as any
    if (typeof Module.require === 'function') {
      try {
        const fs = Module.require('fs')
        if (fs && !fs.__polyfilled) {
          if (!fs.readdir) fs.readdir = ((_: string, cb: any) => cb(null, [])) as any
          if (!fs.readdirSync) fs.readdirSync = ((_: string) => []) as any
          if (!fs.existsSync) fs.existsSync = ((_: string) => false) as any
          fs.__polyfilled = true
        }
      } catch {}
    }
  } catch {}
  globalThis.__fsPolyfilled = true
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
