import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/admin/stats - global admin dashboard statistikasi
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // All restaurants
    const restaurants = await db.restaurant.findMany({
      select: {
        id: true,
        status: true,
        blockedByAdmin: true,
        trialEnd: true,
        activationEnd: true,
        createdAt: true
      }
    })

    const total = restaurants.length
    const active = restaurants.filter(r => {
      if (r.blockedByAdmin) return false
      if (r.activationEnd && r.activationEnd > now) return true
      return false
    }).length
    const trial = restaurants.filter(r => {
      if (r.blockedByAdmin) return false
      if (r.activationEnd && r.activationEnd > now) return false
      return r.trialEnd > now
    }).length
    const blocked = restaurants.filter(r => {
      if (r.blockedByAdmin) return true
      if (r.activationEnd && r.activationEnd > now) return false
      if (r.trialEnd > now) return false
      return true
    }).length

    // Activation codes
    const codesTotal = await db.activationCode.count()
    const codesUsed = await db.activationCode.count({ where: { status: 'used' } })
    const codesUnused = await db.activationCode.count({ where: { status: 'unused' } })

    // Aggregated sales across all restaurants
    const allSales = await db.sale.findMany({
      where: { status: 'completed' },
      select: {
        total: true,
        profit: true,
        costOfGoods: true,
        createdAt: true,
        restaurantId: true
      }
    })

    const totalRevenue = allSales.reduce((s, x) => s + x.total, 0)
    const totalProfit = allSales.reduce((s, x) => s + x.profit, 0)
    const totalCost = allSales.reduce((s, x) => s + x.costOfGoods, 0)

    const todaySales = allSales.filter(s => s.createdAt >= startOfToday)
    const monthSales = allSales.filter(s => s.createdAt >= startOfMonth)

    // Total products, ingredients, customers across all restaurants
    const [totalProducts, totalIngredients, totalCustomers, totalStaff] = await Promise.all([
      db.product.count(),
      db.ingredient.count(),
      db.customer.count(),
      db.staff.count()
    ])

    // New restaurants this month
    const newThisMonth = restaurants.filter(r => r.createdAt >= startOfMonth).length

    // 7-day chart of new restaurants
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentRestaurants = restaurants.filter(r => r.createdAt >= sevenDaysAgo)
    const dayMap = new Map<string, number>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of recentRestaurants) {
      const key = r.createdAt.toISOString().slice(0, 10)
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1)
    }
    const newRestaurants7days = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))

    // Revenue last 7 days
    const revenueDayMap = new Map<string, number>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      revenueDayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const s of allSales) {
      const key = s.createdAt.toISOString().slice(0, 10)
      if (revenueDayMap.has(key)) revenueDayMap.set(key, (revenueDayMap.get(key) || 0) + s.total)
    }
    const revenue7days = Array.from(revenueDayMap.entries()).map(([date, total]) => ({ date, total }))

    return NextResponse.json({
      restaurants: { total, active, trial, blocked, newThisMonth },
      codes: { total: codesTotal, used: codesUsed, unused: codesUnused },
      sales: {
        totalRevenue,
        totalProfit,
        totalCost,
        totalOrders: allSales.length,
        todayRevenue: todaySales.reduce((s, x) => s + x.total, 0),
        todayOrders: todaySales.length,
        monthRevenue: monthSales.reduce((s, x) => s + x.total, 0),
        monthProfit: monthSales.reduce((s, x) => s + x.profit, 0),
        monthOrders: monthSales.length
      },
      catalog: { totalProducts, totalIngredients, totalCustomers, totalStaff },
      newRestaurants7days,
      revenue7days
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
