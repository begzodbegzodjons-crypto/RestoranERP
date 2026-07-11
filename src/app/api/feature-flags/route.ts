import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/feature-flags - restoran feature flaglari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.featureFlag.findMany({
      where: { restaurantId: restaurant.id },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/feature-flags - feature flag yoqib/o'chirib qo'yish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { feature, enabled } = body

    if (!feature) {
      return NextResponse.json({ error: 'feature majburiy' }, { status: 400 })
    }

    // Upsert - agar yo'q bo'lsa yaratish, bo'lsa yangilash
    const existing = await db.featureFlag.findFirst({
      where: { restaurantId: restaurant.id, feature }
    })

    let item
    if (existing) {
      item = await db.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: !!enabled }
      })
    } else {
      item = await db.featureFlag.create({
        data: {
          restaurantId: restaurant.id,
          feature,
          enabled: !!enabled,
        }
      })
    }

    return NextResponse.json({ item, message: 'Feature flag yangilandi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
