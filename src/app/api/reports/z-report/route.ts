import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports/z-report - KUNNIY YAKUNIY HISOBOT (Z-otchet)
// Kun yakunlangan hisobot - noldan boshlab hisob
// ?date=2026-06-29 (ixtiyoriy, default bugun)
// Z-otchet kuni "yopilgan" deb belgilanadi
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')

    const date = dateStr ? new Date(dateStr) : new Date()
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Get all sales for this day
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: 'completed'
      },
      include: {
        items: { include: { product: true } },
        staff: true,
        table: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Get expenses for this day
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: startOfDay, lte: endOfDay }
      }
    })

    // Get purchases for this day
    const purchases = await db.purchase.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startOfDay, lte: endOfDay }
      }
    })

    // Calculate totals
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const totalCost = sales.reduce((s, x) => s + x.costOfGoods, 0)
    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
    const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0)
    const transferSales = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0)
    const totalDiscount = sales.reduce((s, x) => s + x.discount, 0)
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const totalPurchases = purchases.reduce((s, x) => s + x.totalAmount, 0)
    const netProfit = totalProfit - totalExpenses

    // By waiter
    const waiterMap = new Map<string, { name: string; orders: number; revenue: number; profit: number }>()
    for (const s of sales) {
      if (!s.staff) continue
      const ex = waiterMap.get(s.staffId!) || { name: s.staff.name, orders: 0, revenue: 0, profit: 0 }
      ex.orders += 1
      ex.revenue += s.total
      ex.profit += s.profit
      waiterMap.set(s.staffId!, ex)
    }

    // By product
    const productMap = new Map<string, { name: string; qty: number; total: number }>()
    for (const s of sales) {
      for (const it of s.items) {
        const ex = productMap.get(it.productId) || { name: it.product.name, qty: 0, total: 0 }
        ex.qty += it.quantity
        ex.total += it.total
        productMap.set(it.productId, ex)
      }
    }

    // Check if any shift was closed today (Z-report already generated)
    const closedShift = await db.shift.findFirst({
      where: {
        restaurantId: restaurant.id,
        status: 'closed',
        closedAt: { gte: startOfDay, lte: endOfDay }
      }
    })

    return NextResponse.json({
      type: 'Z',
      restaurantName: restaurant.name,
      date: startOfDay,
      dateStr: startOfDay.toLocaleDateString('uz-UZ'),
      timeStr: new Date().toLocaleTimeString('uz-UZ'),
      isClosed: !!closedShift,
      summary: {
        totalSales,
        totalProfit,
        totalCost,
        totalDiscount,
        cashSales,
        cardSales,
        transferSales,
        totalExpenses,
        totalPurchases,
        netProfit,
        orderCount: sales.length,
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0
      },
      byWaiter: Array.from(waiterMap.values()),
      byProduct: Array.from(productMap.values()).sort((a, b) => b.total - a.total),
      sales: sales.map(s => ({
        invoiceNo: s.invoiceNo,
        time: s.createdAt,
        total: s.total,
        profit: s.profit,
        paymentMethod: s.paymentMethod,
        waiter: s.staff?.name || '—',
        table: s.table?.name || '—',
        kassir: s.notes?.includes('Kassir:') ? s.notes.split('Kassir:')[1].trim() : '—'
      })),
      expenses: expenses.map(e => ({
        category: e.category,
        amount: e.amount,
        description: e.description
      })),
      purchases: purchases.map(p => ({
        invoiceNo: p.invoiceNo,
        totalAmount: p.totalAmount
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
