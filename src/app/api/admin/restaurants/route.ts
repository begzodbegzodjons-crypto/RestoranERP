import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/admin/restaurants - barcha restoranlar ro'yxati
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        status: true,
        trialStart: true,
        trialEnd: true,
        activatedAt: true,
        activationEnd: true,
        activationCode: true,
        createdAt: true,
      }
    })

    return NextResponse.json({ restaurants })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
