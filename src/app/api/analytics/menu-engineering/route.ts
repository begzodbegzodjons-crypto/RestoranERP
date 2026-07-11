import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/menu-engineering - Menu Engineering (BCG matrix)
// Stars: yuqori savdo + yuqori foyda
// Plowhorses: yuqori savdo + past foyda
// Puzzles: past savdo + yuqori foyda
// Dogs: past savdo + past foyda
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id },
    })

    const items = []
    for (const p of products) {
      const saleItems = await db.saleItem.findMany({
        where: {
          productId: p.id,
          sale: {
            restaurantId: restaurant.id,
            createdAt: { gte: thirtyDaysAgo },
            status: 'completed',
          }
        },
        select: { quantity: true, total: true, totalCost: true }
      })

      const totalQty = saleItems.reduce((sum: number, si: any) => sum + si.quantity, 0)
      const totalRevenue = saleItems.reduce((sum: number, si: any) => sum + si.total, 0)
      const totalProfit = saleItems.reduce((sum: number, si: any) => sum + (si.total - si.totalCost), 0)
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

      items.push({
        id: p.id,
        name: p.name,
        emoji: p.imageUrl,
        price: p.price,
        totalQty,
        totalRevenue,
        totalProfit,
        profitMargin,
      })
    }

    const avgQty = items.length > 0 ? items.reduce((s, i) => s + i.totalQty, 0) / items.length : 0
    const avgProfit = items.length > 0 ? items.reduce((s, i) => s + i.totalProfit, 0) / items.length : 0

    const matrix = {
      stars: [],
      plowhorses: [],
      puzzles: [],
      dogs: [],
    }

    for (const item of items) {
      const highQty = item.totalQty >= avgQty
      const highProfit = item.totalProfit >= avgProfit

      if (highQty && highProfit) matrix.stars.push(item)
      else if (highQty && !highProfit) matrix.plowhorses.push(item)
      else if (!highQty && highProfit) matrix.puzzles.push(item)
      else matrix.dogs.push(item)
    }

    return NextResponse.json({
      summary: {
        totalProducts: items.length,
        avgQty: Math.round(avgQty * 10) / 10,
        avgProfit: Math.round(avgProfit),
      },
      matrix,
      items: items.sort((a, b) => b.totalRevenue - a.totalRevenue),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
