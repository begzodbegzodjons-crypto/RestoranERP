import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { recalcProductCost } from '@/lib/business'

// DELETE /api/recipes/[id] - retseptdan ingredientni o'chirish
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params

    const existing = await db.recipe.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const productId = existing.productId
    await db.recipe.delete({ where: { id } })

    // Recalc cost
    await recalcProductCost(restaurant.id, productId)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
