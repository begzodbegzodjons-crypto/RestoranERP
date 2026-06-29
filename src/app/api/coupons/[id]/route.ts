import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await db.coupon.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const updated = await db.coupon.update({
      where: { id },
      data: {
        code: body.code ? body.code.toString().toUpperCase().trim() : undefined,
        description: body.description,
        discountType: body.discountType,
        discountValue: body.discountValue != null ? parseFloat(body.discountValue) : undefined,
        minOrder: body.minOrder != null ? parseFloat(body.minOrder) : undefined,
        maxUses: body.maxUses != null ? parseInt(body.maxUses) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : (body.validUntil === null ? null : undefined),
        isActive: body.isActive
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
    const existing = await db.coupon.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    await db.coupon.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
