import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/categories - kategoriya ro'yxati
// POST /api/categories - yangi kategoriya
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
        printerStation: true
      }
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
    if (!body.name) return NextResponse.json({ error: 'Nom kerak' }, { status: 400 })

    const item = await db.category.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        description: body.description || null,
        printerStationId: body.printerStationId || null
      },
      include: { printerStation: true }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
