import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// POST /api/admin/restaurants/[id]/activate - admin tomonidan kodsiz N kunga aktivlashtirish
// Body: { days: number, note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const days = parseInt(body.days)

    if (!days || days < 1 || days > 3650) {
      return NextResponse.json({ error: 'Kunlar soni 1-3650 orasida bo\'lishi kerak' }, { status: 400 })
    }

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    const now = new Date()
    // If currently active and not expired, EXTEND from current end date
    // Otherwise, start fresh from now
    let startDate = now
    if (restaurant.activationEnd && restaurant.activationEnd > now && !restaurant.blockedByAdmin) {
      startDate = new Date(restaurant.activationEnd)
    }

    const newActivationEnd = new Date(startDate)
    newActivationEnd.setDate(newActivationEnd.getDate() + days)

    await db.restaurant.update({
      where: { id },
      data: {
        status: 'active',
        activatedAt: restaurant.activatedAt || now,
        activationEnd: newActivationEnd,
        blockedByAdmin: false,
        blockedReason: null,
        blockedAt: null,
        adminNotes: body.note ? `${restaurant.adminNotes || ''}\n[${now.toISOString()}] ${body.note}`.trim() : restaurant.adminNotes
      }
    })

    await db.adminLog.create({
      data: {
        action: 'admin_activate_restaurant',
        detail: `Activated ${restaurant.email} for ${days} days${body.note ? ': ' + body.note : ''}`
      }
    })

    return NextResponse.json({
      success: true,
      message: `${restaurant.name} ${days} kunga aktivlashtirildi. Tugash: ${newActivationEnd.toLocaleDateString('uz-UZ')}`,
      activationEnd: newActivationEnd
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
