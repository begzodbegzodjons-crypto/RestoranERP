import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/printers - printer stansiyalari ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const stations = await db.printerStation.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        _count: { select: { categories: true, printJobs: true } }
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    })

    return NextResponse.json({ items: stations })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/printers - yangi printer stansiyasi
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Printer nomi majburiy' }, { status: 400 })

    const item = await db.printerStation.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        description: body.description || null,
        sortOrder: parseInt(body.sortOrder) || 0,
        isActive: body.isActive !== false
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
