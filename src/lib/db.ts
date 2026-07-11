// DB wrapper - Prisma API'ga mos, @tidbcloud/serverless driver orqali ishlaydi
// ============================================================================
// Bu fayl @prisma/client o'rnini bosadi. Barcha API route'lari o'zgartirilmasdan
// ishlaydi - `import { db } from '@/lib/db'` o'zgarishsiz qoladi.
//
// Endi Prisma ishlatilmaydi - to'g'ridan-to'g'ri @tidbcloud/serverless orqali
// SQL so'rovlar yuboriladi. Cloudflare Workers'ga to'liq mos.

export { db } from './db/index'
