import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/profitable-dishes - eng foydali taomlar (foyda %)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all sale items in range
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          restaurantId: restaurant.id,
          createdAt: { gte: startDate },
          status: 'completed'
        }
      },
      include: { product: true }
    })

    // Aggregate by product
    const productMap = new Map<string, {
      id: string
      name: string
      price: number
      cost: number
      qtySold: number
      revenue: number
      totalCost: number
      profit: number
      margin: number
    }>()

    for (const si of saleItems) {
      const existing = productMap.get(si.productId) || {
        id: si.productId,
        name: si.product.name,
        price: si.product.price,
        cost: si.product.cost,
        qtySold: 0,
        revenue: 0,
        totalCost: 0,
        profit: 0,
        margin: 0
      }
      existing.qtySold += si.quantity
      existing.revenue += si.total
      existing.totalCost += si.totalCost
      existing.profit += (si.total - si.totalCost)
      productMap.set(si.productId, existing)
    }

    // Calculate margin and sort
    const products = Array.from(productMap.values()).map(p => {
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
      return p
    })

    // Sort by different criteria
    const byProfit = [...products].sort((a, b) => b.profit - a.profit)
    const byMargin = [...products].sort((a, b) => b.margin - a.margin)
    const byQty = [...products].sort((a, b) => b.qtySold - a.qtySold)
    const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue)

    // Least profitable (loss makers)
    const leastProfitable = [...products].sort((a, b) => a.profit - b.profit).slice(0, 5)

    return NextResponse.json({
      summary: {
        totalProducts: products.length,
        totalRevenue: products.reduce((s, p) => s + p.revenue, 0),
        totalProfit: products.reduce((s, p) => s + p.profit, 0),
        avgMargin: products.length > 0 ? products.reduce((s, p) => s + p.margin, 0) / products.length : 0
      },
      topProfitable: byProfit.slice(0, 10),
      topMargin: byMargin.slice(0, 10),
      topSelling: byQty.slice(0, 10),
      topRevenue: byRevenue.slice(0, 10),
      leastProfitable
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
