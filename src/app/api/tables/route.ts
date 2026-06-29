import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.restaurantTable.findMany({
      where: { restaurantId: restaurant.id },
      include: { room: true },
      orderBy: [{ roomId: 'asc' }, { name: 'asc' }]
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

    // Verify room belongs to restaurant (if provided)
    if (body.roomId) {
      const room = await db.room.findFirst({
        where: { id: body.roomId, restaurantId: restaurant.id }
      })
      if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 400 })
    }

    const item = await db.restaurantTable.create({
      data: {
        restaurantId: restaurant.id,
        roomId: body.roomId || null,
        name: body.name,
        seats: parseInt(body.seats) || 4,
        status: body.status || 'free'
      },
      include: { room: true }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
