import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { recalcProductCost } from '@/lib/business'

// GET /api/products - mahsulot (taom) ro'yxati
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId')

    const items = await db.product.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(categoryId ? { categoryId } : {})
      },
      include: {
        category: true,
        recipes: { include: { ingredient: true } }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/products - yangi mahsulot
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.name || body.price == null) {
      return NextResponse.json({ error: 'Nom va narx majburiy' }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: body.categoryId || null,
        name: body.name,
        description: body.description || null,
        price: parseFloat(body.price),
        unit: body.unit || 'dona',
        imageUrl: body.imageUrl || null,
        isAvailable: body.isAvailable !== false
      }
    })

    return NextResponse.json({ item: product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
