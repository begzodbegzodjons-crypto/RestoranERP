import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getAccessStatus } from '@/lib/auth'

// GET /api/admin/restaurants/[id]/stats - bitta restoran to'liq statistikasi
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params

    const restaurant = await db.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        currency: true,
        status: true,
        trialStart: true,
        trialEnd: true,
        activatedAt: true,
        activationEnd: true,
        activationCode: true,
        blockedByAdmin: true,
        blockedReason: true,
        blockedAt: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Counts
    const [productsCount, ingredientsCount, customersCount, staffCount, tablesCount, categoriesCount, suppliersCount] = await Promise.all([
      db.product.count({ where: { restaurantId: id } }),
      db.ingredient.count({ where: { restaurantId: id } }),
      db.customer.count({ where: { restaurantId: id } }),
      db.staff.count({ where: { restaurantId: id } }),
      db.restaurantTable.count({ where: { restaurantId: id } }),
      db.category.count({ where: { restaurantId: id } }),
      db.supplier.count({ where: { restaurantId: id } })
    ])

    // Sales aggregations
    const allSales = await db.sale.findMany({
      where: { restaurantId: id, status: 'completed' },
      select: { total: true, profit: true, costOfGoods: true, createdAt: true, paymentMethod: true }
    })

    const todaySales = allSales.filter(s => s.createdAt >= startOfToday)
    const monthSales = allSales.filter(s => s.createdAt >= startOfMonth)

    // Expenses
    const monthExpenses = await db.expense.aggregate({
      where: { restaurantId: id, date: { gte: startOfMonth } },
      _sum: { amount: true }
    })

    // Purchases
    const monthPurchases = await db.purchase.aggregate({
      where: { restaurantId: id, createdAt: { gte: startOfMonth } },
      _sum: { totalAmount: true }
    })

    // Inventory value
    const ingredients = await db.ingredient.findMany({
      where: { restaurantId: id },
      select: { stock: true, unitPrice: true }
    })
    const inventoryValue = ingredients.reduce((s, i) => s + i.stock * i.unitPrice, 0)

    // Low stock items
    const lowStockItems = await db.ingredient.findMany({
      where: { restaurantId: id, stock: { lte: 0 } },
      select: { name: true, unit: true, stock: true }
    })

    // Top products last 30 days
    const recentSaleItems = await db.saleItem.findMany({
      where: {
        sale: {
          restaurantId: id,
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      include: { product: true }
    })
    const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
    for (const si of recentSaleItems) {
      const ex = productMap.get(si.productId) || { name: si.product.name, qty: 0, revenue: 0, profit: 0 }
      ex.qty += si.quantity
      ex.revenue += si.total
      ex.profit += (si.total - si.totalCost)
      productMap.set(si.productId, ex)
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Recent sales (last 10)
    const recentSales = await db.sale.findMany({
      where: { restaurantId: id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Daily revenue last 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const last14Sales = allSales.filter(s => s.createdAt >= fourteenDaysAgo)
    const dayMap = new Map<string, { date: string; sales: number; profit: number; orders: number }>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { date: key, sales: 0, profit: 0, orders: 0 })
    }
    for (const s of last14Sales) {
      const key = s.createdAt.toISOString().slice(0, 10)
      const e = dayMap.get(key)
      if (e) {
        e.sales += s.total
        e.profit += s.profit
        e.orders += 1
      }
    }
    const dailyRevenue = Array.from(dayMap.values())

    // Payment method breakdown
    const paymentMap = new Map<string, number>()
    for (const s of allSales) {
      paymentMap.set(s.paymentMethod, (paymentMap.get(s.paymentMethod) || 0) + s.total)
    }
    const byPayment = Array.from(paymentMap.entries()).map(([method, total]) => ({ method, total }))

    return NextResponse.json({
      restaurant,
      access: getAccessStatus(restaurant),
      counts: {
        products: productsCount,
        ingredients: ingredientsCount,
        customers: customersCount,
        staff: staffCount,
        tables: tablesCount,
        categories: categoriesCount,
        suppliers: suppliersCount
      },
      stats: {
        totalRevenue: allSales.reduce((s, x) => s + x.total, 0),
        totalProfit: allSales.reduce((s, x) => s + x.profit, 0),
        totalCost: allSales.reduce((s, x) => s + x.costOfGoods, 0),
        totalOrders: allSales.length,
        avgOrder: allSales.length > 0 ? allSales.reduce((s, x) => s + x.total, 0) / allSales.length : 0,
        todayRevenue: todaySales.reduce((s, x) => s + x.total, 0),
        todayOrders: todaySales.length,
        todayProfit: todaySales.reduce((s, x) => s + x.profit, 0),
        monthRevenue: monthSales.reduce((s, x) => s + x.total, 0),
        monthProfit: monthSales.reduce((s, x) => s + x.profit, 0),
        monthOrders: monthSales.length,
        monthExpenses: monthExpenses._sum.amount || 0,
        monthPurchases: monthPurchases._sum.totalAmount || 0,
        monthNetProfit: monthSales.reduce((s, x) => s + x.profit, 0) - (monthExpenses._sum.amount || 0),
        inventoryValue,
        lowStockCount: lowStockItems.length
      },
      lowStockItems,
      topProducts,
      recentSales: recentSales.map(s => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        createdAt: s.createdAt,
        total: s.total,
        profit: s.profit,
        paymentMethod: s.paymentMethod,
        itemCount: s.items.length
      })),
      dailyRevenue,
      byPayment
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
