import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/ingredients - ombor (ingredient) ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.ingredient.findMany({
      where: { restaurantId: restaurant.id },
      include: { supplier: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/ingredients - yangi ingredient
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name || !body.unit) {
      return NextResponse.json({ error: 'Nom va birlik majburiy' }, { status: 400 })
    }

    const item = await db.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        unit: body.unit,
        stock: parseFloat(body.stock) || 0,
        minStock: parseFloat(body.minStock) || 0,
        unitPrice: parseFloat(body.unitPrice) || 0,
        supplierId: body.supplierId || null,
        notes: body.notes || null
      }
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
