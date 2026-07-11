import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/clv - Mijoz Lifetime Value tahlili
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const customers = await db.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { totalSpent: 'desc' },
      take: 100,
    })

    // Mijozlarni CLV bo'yicha guruhlash
    const tiers = {
      vip: { count: 0, totalValue: 0 },       // 5M+ so'm
      high: { count: 0, totalValue: 0 },      // 1M-5M
      medium: { count: 0, totalValue: 0 },    // 200K-1M
      low: { count: 0, totalValue: 0 },       // 0-200K
    }

    for (const c of customers) {
      const value = c.totalSpent
      if (value >= 5000000) { tiers.vip.count++; tiers.vip.totalValue += value }
      else if (value >= 1000000) { tiers.high.count++; tiers.high.totalValue += value }
      else if (value >= 200000) { tiers.medium.count++; tiers.medium.totalValue += value }
      else { tiers.low.count++; tiers.low.totalValue += value }
    }

    // Umumiy statistika
    const totalCustomers = customers.length
    const totalRevenue = customers.reduce((sum: number, c: any) => sum + c.totalSpent, 0)
    const avgCLV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

    // Top 10 mijoz
    const top10 = customers.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalSpent: c.totalSpent,
      totalOrders: c.totalOrders,
      loyaltyPoints: c.loyaltyPoints,
      loyaltyTier: c.loyaltyTier,
      lastVisitAt: c.lastVisitAt,
    }))

    return NextResponse.json({
      summary: {
        totalCustomers,
        totalRevenue,
        avgCLV,
      },
      tiers,
      top10,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
