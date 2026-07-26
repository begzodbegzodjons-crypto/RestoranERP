import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports/z-report - KUNNIY YAKUNIY HISOBOT (Z-otchet)
// Z-otchet olingan vaqtdan keyingi savdolarni hisoblaydi (0'dan boshlaydi)
// POST /api/reports/z-report - Z-otchetni "yopish" (lastZReportAt ni yangilaydi)

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

    // Agar lastZReportAt bo'lsa, undan keyingi savdolarni olamiz
    // Aks holda kun boshidan
    const startTime = restaurant.lastZReportAt && !dateStr
      ? restaurant.lastZReportAt
      : startOfDay

    // Get all sales since last Z-report (or start of day)
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startTime, lte: endOfDay },
        status: 'completed'
      },
      include: {
        items: { include: { product: true } },
        staff: true,
        table: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Cancelled sales (rad etilgan)
    const cancelledSales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startTime, lte: endOfDay },
        status: 'cancelled'
      },
      include: { staff: true, table: true }
    })

    // Get expenses
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: startTime, lte: endOfDay }
      }
    })

    // Get purchases
    const purchases = await db.purchase.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startTime, lte: endOfDay }
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

    // Cancelled totals (rad etilgan summa)
    const cancelledTotal = cancelledSales.reduce((s, x) => s + x.total, 0)

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

    return NextResponse.json({
      type: 'Z',
      restaurantName: restaurant.name,
      date: startOfDay,
      dateStr: startOfDay.toLocaleDateString('uz-UZ'),
      timeStr: new Date().toLocaleTimeString('uz-UZ'),
      lastZReportAt: restaurant.lastZReportAt,
      periodStart: startTime,
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
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0,
        cancelledCount: cancelledSales.length,
        cancelledTotal,
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
      })),
      cancelledSales: cancelledSales.map(s => ({
        invoiceNo: s.invoiceNo,
        time: s.createdAt,
        total: s.total,
        waiter: s.staff?.name || '—',
        table: s.table?.name || '—',
        reason: s.cancelledReason || '—',
        cancelledAt: s.cancelledAt,
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

// POST /api/reports/z-report - Z-otchetni YOPISH
// lastZReportAt ni hozirgi vaqtga yangilaydi
// Keyingi Z-otchet shu vaqtdan keyingi savdolarni hisoblaydi (0'dan boshlaydi)
export async function POST() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const now = new Date()

    await db.restaurant.update({
      where: { id: restaurant.id },
      data: { lastZReportAt: now }
    })

    return NextResponse.json({
      success: true,
      message: 'Z-otchet yopildi. Hisob 0\'dan boshlandi.',
      closedAt: now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
