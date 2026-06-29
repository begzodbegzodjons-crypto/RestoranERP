import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/coupons
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.coupon.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/coupons - yangi kupon
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.code || !body.discountType || body.discountValue == null) {
      return NextResponse.json({ error: 'Kod, tur va qiymat majburiy' }, { status: 400 })
    }

    const code = body.code.toString().toUpperCase().trim()

    // Check uniqueness
    const existing = await db.coupon.findFirst({
      where: { restaurantId: restaurant.id, code }
    })
    if (existing) {
      return NextResponse.json({ error: 'Bu kod allaqachon mavjud' }, { status: 400 })
    }

    const item = await db.coupon.create({
      data: {
        restaurantId: restaurant.id,
        code,
        description: body.description || null,
        discountType: body.discountType, // percent | fixed
        discountValue: parseFloat(body.discountValue),
        minOrder: parseFloat(body.minOrder) || 0,
        maxUses: parseInt(body.maxUses) || 0,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive !== false
      }
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
