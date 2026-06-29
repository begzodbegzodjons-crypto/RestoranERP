import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/audit-logs - admin harakatlar tarixi (faqat admin uchun)
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const logs = await db.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    return NextResponse.json({ items: logs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
