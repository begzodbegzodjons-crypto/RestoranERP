import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/inventory/low-stock - past zaxira ogohlantirishi
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const ingredients = await db.ingredient.findMany({
      where: { restaurantId: restaurant.id },
    })

    const lowStock = ingredients.filter((ing: any) => ing.stock <= ing.minStock)

    // Avtomatik bildirishnoma yaratish (kuniga bir marta)
    const todayKey = new Date().toISOString().slice(0, 10)
    const existingNotifs = await db.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        type: 'low_stock',
        createdAt: { gte: new Date(todayKey) }
      }
    })
    const existingIngredientIds = new Set(existingNotifs.map((n: any) => {
      try { return JSON.parse(n.metadata || '{}').ingredientId } catch { return null }
    }))

    for (const ing of lowStock) {
      if (existingIngredientIds.has(ing.id)) continue

      await db.notification.create({
        data: {
          restaurantId: restaurant.id,
          type: 'low_stock',
          title: '⚠️ Past zaxira ogohlantirishi',
          message: `"${ing.name}" tugab qolayotgan edi! Qoldiq: ${ing.stock} ${ing.unit} (min: ${ing.minStock})`,
          audience: 'all',
          metadata: JSON.stringify({ ingredientId: ing.id, stock: ing.stock, minStock: ing.minStock }),
        }
      })
    }

    return NextResponse.json({
      items: lowStock,
      count: lowStock.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
