import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Nom majburiy' }, { status: 400 })

    const item = await db.customer.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
