import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.staff.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Nom majburiy' }, { status: 400 })

    // PIN validation (4-6 digits) - required for waiter/cashier
    if ((body.position === 'waiter' || body.position === 'cashier') && !body.pin) {
      return NextResponse.json({ error: 'Ofitsiant va kassir uchun PIN majburiy' }, { status: 400 })
    }
    let pin = null
    if (body.pin) {
      if (!/^\d{4,6}$/.test(body.pin)) {
        return NextResponse.json({ error: 'PIN 4-6 raqamli bo\'lishi kerak' }, { status: 400 })
      }
      // Check PIN uniqueness in this restaurant
      const existing = await db.staff.findFirst({
        where: { restaurantId: restaurant.id, pin: body.pin }
      })
      if (existing) {
        return NextResponse.json({ error: 'Bu PIN allaqachon ishlatilgan. Boshqa PIN tanlang.' }, { status: 400 })
      }
      pin = body.pin
    }

    const item = await db.staff.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        phone: body.phone || null,
        position: body.position || null,
        salary: parseFloat(body.salary) || 0,
        status: body.status || 'active',
        pin
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
