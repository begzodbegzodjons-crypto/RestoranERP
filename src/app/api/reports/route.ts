import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports - batafsil hisobot (date range bo'yicha)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date()

    // Sales in range
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: from, lte: to },
        status: 'completed'
      },
      include: {
        items: { include: { product: { include: { category: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Expenses in range
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: from, lte: to }
      },
      orderBy: { date: 'desc' }
    })

    // Purchases in range
    const purchases = await db.purchase.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: from, lte: to }
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
      orderBy: { createdAt: 'desc' }
    })

    // Aggregations
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const totalCost = sales.reduce((s, x) => s + x.costOfGoods, 0)
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const totalPurchases = purchases.reduce((s, x) => s + x.totalAmount, 0)
    const netProfit = totalProfit - totalExpenses

    // Sales by category
    const categoryMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
    for (const sale of sales) {
      for (const item of sale.items) {
        const catName = item.product.category?.name || 'Boshqa'
        const existing = categoryMap.get(catName) || { name: catName, qty: 0, revenue: 0, profit: 0 }
        existing.qty += item.quantity
        existing.revenue += item.total
        existing.profit += (item.total - item.totalCost)
        categoryMap.set(catName, existing)
      }
    }
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)

    // Sales by product
    const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
    for (const sale of sales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productId) || { name: item.product.name, qty: 0, revenue: 0, profit: 0 }
        existing.qty += item.quantity
        existing.revenue += item.total
        existing.profit += (item.total - item.totalCost)
        productMap.set(item.productId, existing)
      }
    }
    const byProduct = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue)

    // Sales by payment method
    const paymentMap = new Map<string, number>()
    for (const sale of sales) {
      paymentMap.set(sale.paymentMethod, (paymentMap.get(sale.paymentMethod) || 0) + sale.total)
    }
    const byPayment = Array.from(paymentMap.entries()).map(([method, total]) => ({ method, total }))

    // Daily breakdown
    const dayMap = new Map<string, { date: string; sales: number; profit: number; orders: number }>()
    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10)
      const existing = dayMap.get(key) || { date: key, sales: 0, profit: 0, orders: 0 }
      existing.sales += sale.total
      existing.profit += sale.profit
      existing.orders += 1
      dayMap.set(key, existing)
    }
    const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      range: { from, to },
      summary: {
        totalSales,
        totalProfit,
        totalCost,
        totalExpenses,
        totalPurchases,
        netProfit,
        orderCount: sales.length,
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0
      },
      byCategory,
      byProduct,
      byPayment,
      byDay,
      recentSales: sales.slice(0, 20).map(s => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        createdAt: s.createdAt,
        total: s.total,
        profit: s.profit,
        paymentMethod: s.paymentMethod,
        itemCount: s.items.length
      })),
      expenses: expenses.slice(0, 50),
      purchases: purchases.slice(0, 50)
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
