import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/messages - xabarlar (admin ↔ restoran muloqot)
export async function GET() {
  try {
    // Restoran yoki admin bo'lishi mumkin
    const restaurant = await getCurrentRestaurant()
    const isAdmin = await isAdminAuthenticated()

    if (!restaurant && !isAdmin) {
      return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })
    }

    // Restoran o'z xabarlarini ko'radi
    // Admin barcha restoranlarning xabarlarini ko'radi
    const where = restaurant ? { restaurantId: restaurant.id } : {}

    const messages = await db.notification.findMany({
      where: {
        ...where,
        type: 'message',
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return NextResponse.json({ items: messages })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/messages - yangi xabar yuborish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    const isAdmin = await isAdminAuthenticated()

    if (!restaurant && !isAdmin) {
      return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })
    }

    const body = await req.json()
    const { message, targetRestaurantId } = body

    if (!message) {
      return NextResponse.json({ error: 'message majburiy' }, { status: 400 })
    }

    // Restoran admin'ga yozadi
    // Admin restoran'ga yozadi
    const restaurantId = isAdmin ? targetRestaurantId : restaurant.id

    if (!restaurantId) {
      return NextResponse.json({ error: 'targetRestaurantId kerak' }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        restaurantId,
        type: 'message',
        title: isAdmin ? 'Admin xabari' : 'Restoran xabari',
        message,
        audience: isAdmin ? 'all' : 'admin',
        metadata: JSON.stringify({
          from: isAdmin ? 'admin' : 'restaurant',
          fromId: restaurant?.id || 'admin',
        }),
      }
    })

    return NextResponse.json({ item: notification, message: 'Xabar yuborildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
