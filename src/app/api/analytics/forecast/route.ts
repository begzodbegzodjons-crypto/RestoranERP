import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/forecast - oylik trend va prognoz (OTS - Oddiy Trend Satri)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Last 6 months data for trend analysis
    const months = 6
    const monthlyData = []

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date()
      start.setMonth(start.getMonth() - i)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)

      const sales = await db.sale.findMany({
        where: {
          restaurantId: restaurant.id,
          createdAt: { gte: start, lt: end },
          status: 'completed'
        },
        select: { total: true, profit: true, costOfGoods: true }
      })

      const totalSales = sales.reduce((s, x) => s + x.total, 0)
      const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
      const totalCost = sales.reduce((s, x) => s + x.costOfGoods, 0)

      monthlyData.push({
        month: start.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' }),
        monthKey: `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}`,
        sales: totalSales,
        profit: totalProfit,
        cost: totalCost,
        orders: sales.length,
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0
      })
    }

    // Linear regression for forecast (OTS - Oddiy Trend Satri)
    // y = a + b*x  where x is month index (0, 1, 2, ...)
    const n = monthlyData.length
    const sumX = monthlyData.reduce((s, _, i) => s + i, 0)
    const sumY = monthlyData.reduce((s, m) => s + m.sales, 0)
    const sumXY = monthlyData.reduce((s, m, i) => s + i * m.sales, 0)
    const sumX2 = monthlyData.reduce((s, _, i) => s + i * i, 0)

    const slope = n > 0 && (n * sumX2 - sumX * sumX) !== 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0

    // Forecast next 3 months
    const forecast = []
    for (let i = 0; i < 3; i++) {
      const x = n + i
      const forecasted = Math.max(0, intercept + slope * x)
      const date = new Date()
      date.setMonth(date.getMonth() + i + 1)
      forecast.push({
        month: date.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        forecastedSales: Math.round(forecasted),
        isForecast: true
      })
    }

    // Trend direction
    const trendDirection = slope > 0 ? 'growing' : slope < 0 ? 'declining' : 'stable'
    const trendPercent = monthlyData[0].sales > 0 ? ((monthlyData[n - 1].sales - monthlyData[0].sales) / monthlyData[0].sales) * 100 : 0

    // Growth rate (month over month)
    const growthRates = []
    for (let i = 1; i < monthlyData.length; i++) {
      const prev = monthlyData[i - 1].sales
      const curr = monthlyData[i].sales
      const growth = prev > 0 ? ((curr - prev) / prev) * 100 : 0
      growthRates.push({
        month: monthlyData[i].month,
        growth
      })
    }

    // Seasonality analysis - which months/seasons sell more
    const allSales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        status: 'completed'
      },
      select: { total: true, createdAt: true }
    })

    const seasonMap = new Map<string, number>()
    for (const s of allSales) {
      const month = new Date(s.createdAt).getMonth()
      const season = month < 3 || month === 11 ? 'Qish' : month < 6 ? 'Bahor' : month < 9 ? 'Yoz' : 'Kuz'
      seasonMap.set(season, (seasonMap.get(season) || 0) + s.total)
    }

    const seasons = ['Qish', 'Bahor', 'Yoz', 'Kuz'].map(s => ({
      season: s,
      total: seasonMap.get(s) || 0
    }))

    return NextResponse.json({
      historical: monthlyData,
      forecast,
      trend: {
        direction: trendDirection,
        percent: trendPercent,
        slope: Math.round(slope),
        avgGrowthRate: growthRates.length > 0 ? growthRates.reduce((s, g) => s + g.growth, 0) / growthRates.length : 0
      },
      growthRates,
      seasons,
      summary: {
        totalSales6Months: monthlyData.reduce((s, m) => s + m.sales, 0),
        avgMonthlySales: monthlyData.reduce((s, m) => s + m.sales, 0) / n,
        nextMonthForecast: forecast[0]?.forecastedSales || 0,
        bestSeason: seasons.sort((a, b) => b.total - a.total)[0]?.season || '—'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
