import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports/x-report - KUNLIK ORALIQ HISOBOT (X-otchet)
// Bugungi savdolar 00:00 dan hozirgacha
// ?date=2026-06-29 (ixtiyoriy, default bugun)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')

    // Determine date range: 00:00 to 23:59 of the selected day
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

    // Calculate totals
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const totalCost = sales.reduce((s, x) => s + x.costOfGoods, 0)
    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
    const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0)
    const transferSales = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0)
    const totalDiscount = sales.reduce((s, x) => s + x.discount, 0)

    // By waiter
    const waiterMap = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const s of sales) {
      if (!s.staff) continue
      const ex = waiterMap.get(s.staffId!) || { name: s.staff.name, orders: 0, revenue: 0 }
      ex.orders += 1
      ex.revenue += s.total
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
      type: 'X',
      restaurantName: restaurant.name,
      date: startOfDay,
      dateStr: startOfDay.toLocaleDateString('uz-UZ'),
      timeStr: new Date().toLocaleTimeString('uz-UZ'),
      summary: {
        totalSales,
        totalProfit,
        totalCost,
        totalDiscount,
        cashSales,
        cardSales,
        transferSales,
        orderCount: sales.length,
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0
      },
      byWaiter: Array.from(waiterMap.values()),
      byProduct: Array.from(productMap.values()).sort((a, b) => b.total - a.total),
      sales: sales.map(s => ({
        invoiceNo: s.invoiceNo,
        time: s.createdAt,
        total: s.total,
        paymentMethod: s.paymentMethod,
        waiter: s.staff?.name || '—',
        table: s.table?.name || '—'
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
