import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/hourly - soatlik savdo grafigi
// Qachon ko'p mijoz kelishini ko'rsatadi
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate },
        status: 'completed'
      },
      select: { total: true, profit: true, createdAt: true }
    })

    // 24 soatlik grid (0-23)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      sales: 0,
      profit: 0,
      orderCount: 0
    }))

    for (const s of sales) {
      const hour = new Date(s.createdAt).getHours()
      hourlyData[hour].sales += s.total
      hourlyData[hour].profit += s.profit
      hourlyData[hour].orderCount += 1
    }

    // Eng band soatlar (top 3)
    const busiestHours = [...hourlyData]
      .sort((a, b) => b.orderCount - a.orderCount)
      .filter(h => h.orderCount > 0)
      .slice(0, 3)

    // Kun davomida tahlil
    const morning = hourlyData.slice(6, 12).reduce((s, h) => s + h.orderCount, 0)
    const afternoon = hourlyData.slice(12, 18).reduce((s, h) => s + h.orderCount, 0)
    const evening = hourlyData.slice(18, 24).reduce((s, h) => s + h.orderCount, 0)
    const night = hourlyData.slice(0, 6).reduce((s, h) => s + h.orderCount, 0)

    const dayParts = [
      { name: '🌅 Ertalab (06-12)', count: morning, percent: 0 },
      { name: '☀️ Tushdan keyin (12-18)', count: afternoon, percent: 0 },
      { name: '🌆 Kechqurun (18-24)', count: evening, percent: 0 },
      { name: '🌙 Tunda (00-06)', count: night, percent: 0 }
    ]
    const totalOrders = morning + afternoon + evening + night
    dayParts.forEach(p => p.percent = totalOrders > 0 ? (p.count / totalOrders) * 100 : 0)

    return NextResponse.json({
      hourlyData,
      busiestHours,
      dayParts,
      summary: {
        totalSales: sales.reduce((s, x) => s + x.total, 0),
        totalOrders: sales.length,
        avgOrder: sales.length > 0 ? sales.reduce((s, x) => s + x.total, 0) / sales.length : 0,
        peakHour: busiestHours[0]?.hour || 0
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
