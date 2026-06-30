import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const item = await db.purchase.findFirst({
      where: { id, restaurantId: restaurant.id },
      include: { supplier: true, items: { include: { ingredient: true } } }
    })
    if (!item) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const existing = await db.purchase.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    await db.purchase.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
