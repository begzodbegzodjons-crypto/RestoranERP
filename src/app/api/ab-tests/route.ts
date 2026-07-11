import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/ab-tests - A/B testlar ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.abTest.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/ab-tests - yangi A/B test yaratish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { name, description, testType, productId, variantA, variantB } = body

    if (!name || !variantA || !variantB) {
      return NextResponse.json({ error: 'name, variantA va variantB majburiy' }, { status: 400 })
    }

    const test = await db.abTest.create({
      data: {
        restaurantId: restaurant.id,
        name,
        description: description || null,
        testType: testType || 'price',
        productId: productId || null,
        variantA: typeof variantA === 'string' ? variantA : JSON.stringify(variantA),
        variantB: typeof variantB === 'string' ? variantB : JSON.stringify(variantB),
        status: 'running',
      }
    })

    return NextResponse.json({ item: test, message: 'A/B test boshlandi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
