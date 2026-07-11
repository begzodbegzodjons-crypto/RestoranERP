// Prisma client - TiDB Cloud + Cloudflare Workers muhitga moslashtirilgan
// ============================================================================
// Cloudflare Workers `node:fs` modulini unenv stub sifatida beradi - readdir
// funksiyasi "not implemented" xatosi beradi. Prisma'ning getCurrentBinaryTarget
// logic'i fs.readdir chaqiradi (Linux tizimida OpenSSL versiyasini aniqlash).
//
// Yechim: Prisma'ning binary target detection logicasini chetlab o'tish uchun
// 3 narsani polyfill qilamiz:
// 1. process.versions - Prisma platform detection uchun
// 2. fs.readdir/readdirSync - OpenSSL detection uchun (bo'sh array qaytaradi)
// 3. fs.existsSync - schema.prisma qidirish uchun (false qaytaradi)
//
// Bu polyfills global darajada o'rnatiladi - Prisma import qilinishidan oldin.

import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

// ===== GLOBAL POLYFILLS =====
declare global {
  // eslint-disable-next-line no-var
  var __polyfillsInstalled: boolean | undefined
}

if (!globalThis.__polyfillsInstalled) {
  const g = globalThis as any

  // 1. process.versions ni soxtalashtirish (Prisa platform detection uchun)
  if (typeof process !== 'undefined') {
    const p = process as any
    if (!p.versions) p.versions = {}
    if (!p.versions.openssl) p.versions.openssl = '3.0.0'
    if (!p.platform) p.platform = 'linux'
    if (!p.arch) p.arch = 'x64'
  }

  // 2. fs modulini patch qilish - Modul cache'iga kirib
  try {
    // @ts-ignore
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const fs = require('fs')

    // Asl funksiyalarni saqlash va patch qilish
    const noopReaddir = (...args: any[]) => {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        cb(null, [])
        return undefined
      }
      return Promise.resolve([])
    }
    const noopReaddirSync = (..._args: any[]) => []
    const noopExistsSync = (_path: string) => false

    // Patch - try/catch bilan (read-only propertylar uchun)
    const props = [
      ['readdir', noopReaddir],
      ['readdirSync', noopReaddirSync],
      ['existsSync', noopExistsSync],
    ] as const

    for (const [name, fn] of props) {
      try {
        Object.defineProperty(fs, name, {
          value: fn,
          writable: true,
          configurable: true,
          enumerable: true,
        })
      } catch {
        try { (fs as any)[name] = fn } catch {}
      }
    }
  } catch (e) {
    console.warn('[db] fs patch failed (createRequire):', e)
  }

  globalThis.__polyfillsInstalled = true
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
