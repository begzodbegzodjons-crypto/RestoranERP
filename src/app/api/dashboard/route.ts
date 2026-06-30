import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/dashboard - bosh sahifa statistikasi
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Today's sales
    const todaySales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startOfToday },
        status: 'completed'
      },
      select: { total: true, profit: true, costOfGoods: true }
    })

    // Month's sales
    const monthSales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startOfMonth },
        status: 'completed'
      },
      select: { total: true, profit: true, costOfGoods: true }
    })

    // 7-day sales for chart
    const last7Days = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: sevenDaysAgo },
        status: 'completed'
      },
      select: { total: true, profit: true, createdAt: true }
    })

    // Group by day
    const dayMap = new Map<string, { sales: number; profit: number }>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { sales: 0, profit: 0 })
    }
    for (const s of last7Days) {
      const key = s.createdAt.toISOString().slice(0, 10)
      const entry = dayMap.get(key)
      if (entry) {
        entry.sales += s.total
        entry.profit += s.profit
      }
    }
    const chart7days = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      sales: Math.round(v.sales),
      profit: Math.round(v.profit)
    }))

    // Counts
    const [productsCount, ingredientsCount, customersCount, staffCount, tablesCount, lowStockCount, monthExpenses] = await Promise.all([
      db.product.count({ where: { restaurantId: restaurant.id } }),
      db.ingredient.count({ where: { restaurantId: restaurant.id } }),
      db.customer.count({ where: { restaurantId: restaurant.id } }),
      db.staff.count({ where: { restaurantId: restaurant.id } }),
      db.restaurantTable.count({ where: { restaurantId: restaurant.id } }),
      db.ingredient.count({
        where: {
          restaurantId: restaurant.id,
          stock: { lte: 0 }
        }
      }),
      db.expense.aggregate({
        where: { restaurantId: restaurant.id, date: { gte: startOfMonth } },
        _sum: { amount: true }
      })
    ])

    // Low stock ingredients
    const lowStock = await db.ingredient.findMany({
      where: {
        restaurantId: restaurant.id,
        stock: { lte: 0 }
      },
      take: 10
    })

    // Top products (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentSaleItems = await db.saleItem.findMany({
      where: {
        sale: {
          restaurantId: restaurant.id,
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      include: { product: true }
    })
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const si of recentSaleItems) {
      const existing = productSales.get(si.productId) || { name: si.product.name, qty: 0, revenue: 0 }
      existing.qty += si.quantity
      existing.revenue += si.total
      productSales.set(si.productId, existing)
    }
    const topProducts = Array.from(productSales.entries())
      .map(([id, v]) => ({ id, name: v.name, qty: v.qty, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    return NextResponse.json({
      today: {
        sales: todaySales.reduce((s, x) => s + x.total, 0),
        profit: todaySales.reduce((s, x) => s + x.profit, 0),
        cost: todaySales.reduce((s, x) => s + x.costOfGoods, 0),
        count: todaySales.length
      },
      month: {
        sales: monthSales.reduce((s, x) => s + x.total, 0),
        profit: monthSales.reduce((s, x) => s + x.profit, 0),
        cost: monthSales.reduce((s, x) => s + x.costOfGoods, 0),
        count: monthSales.length,
        expenses: monthExpenses._sum.amount || 0,
        netProfit: monthSales.reduce((s, x) => s + x.profit, 0) - (monthExpenses._sum.amount || 0)
      },
      chart7days,
      counts: {
        products: productsCount,
        ingredients: ingredientsCount,
        customers: customersCount,
        staff: staffCount,
        tables: tablesCount,
        lowStock: lowStockCount
      },
      lowStock,
      topProducts
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
