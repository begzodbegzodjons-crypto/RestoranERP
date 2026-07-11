import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/loyalty/tiers - sodiqlik darajalari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.loyaltyTier.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { minPoints: 'asc' },
    })

    // Default tierlar yaratish (birinchi marta)
    if (items.length === 0) {
      const defaults = [
        { name: 'Bronze', minPoints: 0, discountPercent: 0, color: 'amber' },
        { name: 'Silver', minPoints: 1000, discountPercent: 5, color: 'slate' },
        { name: 'Gold', minPoints: 5000, discountPercent: 10, color: 'yellow' },
        { name: 'Platinum', minPoints: 20000, discountPercent: 15, color: 'purple' },
      ]
      for (const t of defaults) {
        await db.loyaltyTier.create({
          data: { restaurantId: restaurant.id, ...t }
        })
      }
      const newItems = await db.loyaltyTier.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { minPoints: 'asc' },
      })
      return NextResponse.json({ items: newItems })
    }

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/loyalty/tiers - yangi daraja qo'shish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { name, minPoints, discountPercent, color } = body

    if (!name || minPoints === undefined) {
      return NextResponse.json({ error: 'name va minPoints majburiy' }, { status: 400 })
    }

    const tier = await db.loyaltyTier.create({
      data: {
        restaurantId: restaurant.id,
        name,
        minPoints: parseInt(minPoints) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
        color: color || 'slate',
      }
    })

    return NextResponse.json({ item: tier, message: 'Daraja yaratildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
