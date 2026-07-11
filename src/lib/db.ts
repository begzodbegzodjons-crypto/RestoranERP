// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers `node:fs` modulini unenv stub sifatida beradi - readdir
// funksiyasi "not implemented" xatosi beradi. Prisma'ning binaryTarget
// detection logic'i fs.readdir chaqiradi (Linux tizimida OpenSSL versiyasini
// aniqlash uchun). Bu funksiya driver adapter ishlatilganda kerak emas, lekin
// Prisma init kod baraban chaqiradi.
//
// Yechim: Node.js Module._cache'dagi fs modulini to'g'ridan-to'g'ri modify qilamiz
// (unenv stub'ini almashtiramiz). Bu polyfill global darajada amalga oshiriladi.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

// ===== FS POLYFILL (Cloudflare Workers uchun) =====
// Prisma'ning getCurrentBinaryTarget() funksiyasi fs.readdir/readdirSync chaqiradi.
// CF Workers'da bu funksiyalar "not implemented" xatosi beradi.
// Polyfill: bo'sh array qaytaradi - Prisma engine ishlatmaydi (adapter bor).
declare global {
  // eslint-disable-next-line no-var
  var __prismaFsPolyfillInstalled: boolean | undefined
}

if (!globalThis.__prismaFsPolyfillInstalled) {
  // Module system orqali fs modulini olish va patch qilish
  try {
    // @ts-ignore - createRequire Node.js'da mavjud
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const fs = require('fs')

    // readdir - async (path, options, cb) yoki (path, cb)
    const fakeReaddir = (...args: any[]) => {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        cb(null, [])
        return undefined
      }
      return Promise.resolve([])
    }
    const fakeReaddirSync = (..._args: any[]) => []

    // Patch - faqat agar funksiya stub bo'lsa (xato qaytarsa)
    try {
      fs.readdir = fakeReaddir as any
    } catch {}
    try {
      fs.readdirSync = fakeReaddirSync as any
    } catch {}

    // existsSync - schema.prisma qidirish uchun
    if (!fs.existsSync || typeof fs.existsSync !== 'function') {
      try { fs.existsSync = ((_: string) => false) as any } catch {}
    }
  } catch (e) {
    // createRequire ishlamasa - to'g'ridan-to'g'ri import orqali
    try {
      const fs = await import('node:fs')
      const fakeReaddir = (...args: any[]) => {
        const cb = args[args.length - 1]
        if (typeof cb === 'function') {
          cb(null, [])
          return undefined
        }
        return Promise.resolve([])
      }
      const fakeReaddirSync = (..._args: any[]) => []

      try { fs.readdir = fakeReaddir as any } catch {}
      try { fs.readdirSync = fakeReaddirSync as any } catch {}
      try { fs.default.readdir = fakeReaddir as any } catch {}
      try { fs.default.readdirSync = fakeReaddirSync as any } catch {}
    } catch (e2) {
      console.warn('[db] fs polyfill failed:', e2)
    }
  }
  globalThis.__prismaFsPolyfillInstalled = true
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
