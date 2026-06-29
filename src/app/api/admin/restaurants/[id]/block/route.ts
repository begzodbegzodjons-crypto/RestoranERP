import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// POST /api/admin/restaurants/[id]/block - restoranni bloklash
// Body: { reason?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'Admin tomonidan bloklangan'

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    await db.restaurant.update({
      where: { id },
      data: {
        blockedByAdmin: true,
        blockedReason: reason,
        blockedAt: new Date(),
        status: 'blocked'
      }
    })

    // Delete all active sessions (force logout)
    await db.session.deleteMany({ where: { restaurantId: id } })

    await db.adminLog.create({
      data: {
        action: 'block_restaurant',
        detail: `Blocked ${restaurant.email}: ${reason}`
      }
    })

    return NextResponse.json({
      success: true,
      message: `${restaurant.name} bloklandi. Foydalanuvchi tizimdan chiqarildi.`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/restaurants/[id]/block - blokdan chiqarish (unblock)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    // Determine new status based on dates
    const now = new Date()
    let newStatus = 'blocked'
    if (restaurant.activationEnd && restaurant.activationEnd > now) {
      newStatus = 'active'
    } else if (restaurant.trialEnd > now) {
      newStatus = 'trial'
    }

    await db.restaurant.update({
      where: { id },
      data: {
        blockedByAdmin: false,
        blockedReason: null,
        blockedAt: null,
        status: newStatus
      }
    })

    await db.adminLog.create({
      data: {
        action: 'unblock_restaurant',
        detail: `Unblocked ${restaurant.email}`
      }
    })

    return NextResponse.json({
      success: true,
      message: `${restaurant.name} blokdan chiqarildi. Yangi holat: ${newStatus}`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
