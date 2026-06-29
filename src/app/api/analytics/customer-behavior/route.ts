import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/customer-behavior - mijoz xatti-harakatlari
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '90')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const customers = await db.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { totalSpent: 'desc' }
    })

    // Returning customers (2+ orders)
    const returning = customers.filter(c => c.totalOrders >= 2)
    const newCustomers = customers.filter(c => c.totalOrders === 1)
    const vipCustomers = customers.filter(c => c.totalSpent >= 500000)

    // Retention rate
    const retentionRate = customers.length > 0 ? (returning.length / customers.length) * 100 : 0

    // Top customers by spend
    const topSpenders = customers.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      loyaltyPoints: c.loyaltyPoints,
      avgOrder: c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0,
      lastOrderDays: c.totalOrders > 0 ? 'recent' : 'never'
    }))

    // Frequency distribution
    const frequencyBuckets = [
      { label: '1 marta (yangi)', count: newCustomers.length, percent: 0 },
      { label: '2-3 marta', count: customers.filter(c => c.totalOrders >= 2 && c.totalOrders <= 3).length, percent: 0 },
      { label: '4-10 marta', count: customers.filter(c => c.totalOrders >= 4 && c.totalOrders <= 10).length, percent: 0 },
      { label: '10+ marta (sodiq)', count: customers.filter(c => c.totalOrders > 10).length, percent: 0 }
    ]
    const total = frequencyBuckets.reduce((s, b) => s + b.count, 0)
    frequencyBuckets.forEach(b => b.percent = total > 0 ? (b.count / total) * 100 : 0)

    // Recent sales for trend analysis
    const recentSales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate },
        status: 'completed',
        customerId: { not: null }
      },
      select: { customerId: true, createdAt: true, total: true }
    })

    // Calculate avg days between orders (for returning customers)
    const customerOrderDates = new Map<string, Date[]>()
    for (const s of recentSales) {
      if (!s.customerId) continue
      const dates = customerOrderDates.get(s.customerId) || []
      dates.push(s.createdAt)
      customerOrderDates.set(s.customerId, dates)
    }

    let totalDaysBetween = 0
    let pairsCount = 0
    for (const dates of customerOrderDates.values()) {
      if (dates.length < 2) continue
      dates.sort((a, b) => a.getTime() - b.getTime())
      for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        totalDaysBetween += diff
        pairsCount++
      }
    }
    const avgDaysBetweenOrders = pairsCount > 0 ? totalDaysBetween / pairsCount : 0

    return NextResponse.json({
      summary: {
        totalCustomers: customers.length,
        returningCustomers: returning.length,
        newCustomers: newCustomers.length,
        vipCustomers: vipCustomers.length,
        retentionRate,
        avgDaysBetweenOrders
      },
      topSpenders,
      frequencyBuckets,
      // Churn risk: customers who haven't ordered in 30+ days
      churnRisk: customers.filter(c => c.totalOrders > 0).length - recentSales.filter(s => s.customerId && new Date(s.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
