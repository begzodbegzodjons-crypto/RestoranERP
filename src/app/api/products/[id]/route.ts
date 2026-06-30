import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { recalcProductCost } from '@/lib/business'

// PUT /api/products/[id] - mahsulotni yangilash
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existing = await db.product.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const updated = await db.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId || null,
        price: parseFloat(body.price),
        unit: body.unit,
        imageUrl: body.imageUrl,
        isAvailable: body.isAvailable
      }
    })

    return NextResponse.json({ item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/products/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params

    const existing = await db.product.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    // Delete recipes first
    await db.recipe.deleteMany({ where: { productId: id, restaurantId: restaurant.id } })
    await db.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
