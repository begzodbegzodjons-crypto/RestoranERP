import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/inventory - ombor harakatlari tarixi
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const ingredientId = searchParams.get('ingredientId')
    const limit = parseInt(searchParams.get('limit') || '200')

    const items = await db.inventoryItem.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(ingredientId ? { ingredientId } : {})
      },
      include: { ingredient: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
