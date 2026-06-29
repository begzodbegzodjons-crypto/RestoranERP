import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.expense.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { date: 'desc' },
      take: 200
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
    if (!body.category || !body.amount) return NextResponse.json({ error: 'Kategoriya va summa majburiy' }, { status: 400 })

    const item = await db.expense.create({
      data: {
        restaurantId: restaurant.id,
        category: body.category,
        amount: parseFloat(body.amount),
        description: body.description || null,
        date: body.date ? new Date(body.date) : new Date()
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
