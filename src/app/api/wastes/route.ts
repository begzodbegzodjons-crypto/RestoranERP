import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/wastes - brak/isrof ro'yxati
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const type = searchParams.get('type')

    const items = await db.waste.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(type ? { type } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/wastes - yangi brak/isrof yozuvi
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { ingredientId, productId, type, quantity, unit, cost, reason, staffId } = body

    if (!quantity || !unit) {
      return NextResponse.json({ error: 'quantity va unit majburiy' }, { status: 400 })
    }

    if (!ingredientId && !productId) {
      return NextResponse.json({ error: 'ingredientId yoki productId kerak' }, { status: 400 })
    }

    const waste = await db.waste.create({
      data: {
        restaurantId: restaurant.id,
        ingredientId: ingredientId || null,
        productId: productId || null,
        type: type || 'waste',
        quantity,
        unit,
        cost: cost || 0,
        reason: reason || null,
        staffId: staffId || null,
      }
    })

    // Agar ingredient bo'lsa, ombordan chiqarish
    if (ingredientId) {
      await db.ingredient.update({
        where: { id: ingredientId },
        data: { stock: { decrement: quantity } }
      })
      await db.inventoryItem.create({
        data: {
          restaurantId: restaurant.id,
          ingredientId,
          type: 'out',
          quantity,
          unitPrice: cost || 0,
          reason: 'waste',
          refType: 'Waste',
          refId: waste.id,
        }
      })
    }

    return NextResponse.json({ item: waste, message: 'Brak/isrof qayd etildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
