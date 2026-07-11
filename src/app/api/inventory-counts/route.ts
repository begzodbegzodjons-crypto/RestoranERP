import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/inventory-counts - inventarizatsiya ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.inventoryCount.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/inventory-counts - yangi inventarizatsiya boshlash
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { notes } = body

    // Barcha ingredientlarni olish
    const ingredients = await db.ingredient.findMany({
      where: { restaurantId: restaurant.id },
    })

    // Items JSON - har bir ingredient uchun expected qty
    const items = ingredients.map(ing => ({
      ingredientId: ing.id,
      ingredientName: ing.name,
      expectedQty: ing.stock,
      actualQty: ing.stock,
      diff: 0,
      note: '',
    }))

    const count = await db.inventoryCount.create({
      data: {
        restaurantId: restaurant.id,
        status: 'in_progress',
        startedAt: new Date(),
        notes: notes || null,
        items: JSON.stringify(items),
      }
    })

    return NextResponse.json({ item: count, message: 'Inventarizatsiya boshlandi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
