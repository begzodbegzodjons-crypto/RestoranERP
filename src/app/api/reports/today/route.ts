import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports/today - Bugungi savdo (Z-otchet dan keyin)
// lastZReportAt dan hozirgacha bo'lgan savdolarni qaytaradi
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const now = new Date()
    // Z-otchet olingan bo'lsa, undan keyingi savdolarni hisoblash
    const startTime = restaurant.lastZReportAt || new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Savdolar
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startTime, lte: now },
        status: 'completed'
      },
      include: {
        items: { include: { product: true } },
        staff: true,
        table: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Bekor qilingan
    const cancelled = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startTime, lte: now },
        status: 'cancelled'
      }
    })

    // Hisob-kitob
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
    const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0)
    const transferSales = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0)
    const cancelledTotal = cancelled.reduce((s, x) => s + x.total, 0)

    // Taomlar bo'yicha
    const productMap = new Map<string, { name: string; qty: number; total: number }>()
    for (const s of sales) {
      for (const it of s.items) {
        const ex = productMap.get(it.productId) || { name: it.product.name, qty: 0, total: 0 }
        ex.qty += it.quantity
        ex.total += it.total
        productMap.set(it.productId, ex)
      }
    }

    // Ofitsiantlar bo'yicha
    const waiterMap = new Map<string, { name: string; orders: number; revenue: number; profit: number }>()
    for (const s of sales) {
      if (!s.staff) continue
      const ex = waiterMap.get(s.staffId!) || { name: s.staff.name, orders: 0, revenue: 0, profit: 0 }
      ex.orders += 1
      ex.revenue += s.total
      ex.profit += s.profit
      waiterMap.set(s.staffId!, ex)
    }

    return NextResponse.json({
      totalSales,
      totalProfit,
      cashSales,
      cardSales,
      transferSales,
      orderCount: sales.length,
      cancelledCount: cancelled.length,
      cancelledTotal,
      periodStart: startTime,
      byProduct: Array.from(productMap.values()).sort((a, b) => b.total - a.total),
      byWaiter: Array.from(waiterMap.values()),
      sales: sales.map(s => ({
        invoiceNo: s.invoiceNo,
        time: s.createdAt,
        total: s.total,
        profit: s.profit,
        paymentMethod: s.paymentMethod,
        waiter: s.staff?.name || '—',
        table: s.table?.name || '—',
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
