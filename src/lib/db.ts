// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers `fs` modulini to'liq qo'llab-quvvatlamaydi.
// Prisma Client init paytida:
//   1. fs.existsSync - schema.prisma faylini qidirish uchun
//   2. fs.readdir - OpenSSL/libssl version detection uchun (binaryTarget)
//
// Ikkala holatda ham Prisma engine kerak emas (driver adapter ishlatamiz),
// lekin init kod baraban fs.readdir chaqiradi.
//
// Yechim: Node.js built-in `fs` modulini polyfill qilamiz - readdir/readdirSync
// bo'sh array qaytaradi, existsSync false qaytaradi. Bu Prisma'ning init
// logicasini "hammasi joyida" deb ishontiradi.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

// ===== FS POLYFILL =====
// Cloudflare Workers'da `fs` moduli partial implemented - readdir yo'q.
// Prisma init kodini ishga tushirish uchun polyfill qo'shamiz.
// Bu global darajada amalga oshiriladi - boshqa modullar ham foydalanadi.
if (typeof globalThis !== 'undefined') {
  const g = globalThis as any

  // node:fs polyfill - faqat birinchi marta
  if (!g.__fsPolyfillInstalled) {
    try {
      // node:fs modulini olishga urinamiz
      let fsModule: any
      try {
        fsModule = await import('node:fs')
      } catch {
        try {
          fsModule = await import('fs')
        } catch {
          fsModule = null
        }
      }

      if (fsModule) {
        // readdir - Prisma binaryTarget detection uchun
        if (!fsModule.readdir) {
          fsModule.readdir = function(_path: string, optionsOrCb: any, cb?: any) {
            // support both (path, cb) and (path, options, cb)
            const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
            if (callback) callback(null, [])
            return Promise.resolve([])
          }
        }
        if (!fsModule.readdirSync) {
          fsModule.readdirSync = function(_path: string) { return [] }
        }
        // existsSync - schema.prisma qidirish uchun
        if (!fsModule.existsSync) {
          fsModule.existsSync = function(_path: string) { return false }
        }
        // readFile - ba'zi Prisma versiyalari uchun
        if (!fsModule.readFile) {
          fsModule.readFile = function(_path: string, optionsOrCb: any, cb?: any) {
            const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
            if (callback) callback(new Error('File not found in polyfill'))
            return Promise.reject(new Error('File not found in polyfill'))
          }
        }
        if (!fsModule.readFileSync) {
          fsModule.readFileSync = function(_path: string) {
            throw new Error('File not found in polyfill')
          }
        }
      }
    } catch (e) {
      console.warn('[db] fs polyfill failed:', e)
    }
    g.__fsPolyfillInstalled = true
  }
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
