import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/rooms - xonalar ro'yxati (stollar soni bilan)
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const rooms = await db.room.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        _count: { select: { tables: true } }
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    })

    return NextResponse.json({ items: rooms })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/rooms - yangi xona
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Xona nomi majburiy' }, { status: 400 })

    const item = await db.room.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        description: body.description || null,
        color: body.color || 'emerald',
        sortOrder: parseInt(body.sortOrder) || 0,
        isActive: body.isActive !== false
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
