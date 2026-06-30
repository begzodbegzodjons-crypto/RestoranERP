import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// PUT /api/ingredients/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await db.ingredient.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const updated = await db.ingredient.update({
      where: { id },
      data: {
        name: body.name,
        unit: body.unit,
        minStock: parseFloat(body.minStock) || 0,
        unitPrice: parseFloat(body.unitPrice) || 0,
        supplierId: body.supplierId || null,
        notes: body.notes,
        // Allow manual stock correction
        ...(body.stock !== undefined ? { stock: parseFloat(body.stock) } : {})
      }
    })

    return NextResponse.json({ item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const existing = await db.ingredient.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    await db.ingredient.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
