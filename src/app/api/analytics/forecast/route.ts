import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/forecast - AI savdo prognozi
// Oddiy forecasting algoritmi: o'tgan 30 kunlik savdo asosida
// kelgusi 7-14 kunlik prognoz (moving average + trend)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7') // kelgusi kunlar soni

    // Oxirgi 60 kunlik savdo ma'lumotlari
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: sixtyDaysAgo },
        status: { in: ['completed', 'partial_refund'] }
      },
      select: { total: true, profit: true, createdAt: true }
    })

    // Kunlik guruhlash
    const dailyData: Record<string, { revenue: number; profit: number; count: number }> = {}
    for (const s of sales) {
      const dateKey = new Date(s.createdAt).toISOString().slice(0, 10)
      if (!dailyData[dateKey]) dailyData[dateKey] = { revenue: 0, profit: 0, count: 0 }
      dailyData[dateKey].revenue += s.total
      dailyData[dateKey].profit += s.profit
      dailyData[dateKey].count++
    }

    // So'nggi 30 kunni olish (yetishmayotgan kunlarni 0 bilan to'ldirish)
    const last30Days: Array<{ date: string; revenue: number; profit: number; count: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateKey = d.toISOString().slice(0, 10)
      const data = dailyData[dateKey] || { revenue: 0, profit: 0, count: 0 }
      last30Days.push({ date: dateKey, ...data })
    }

    // Moving average (7 kunlik)
    const ma7 = last30Days.slice(-7).reduce((s, d) => s + d.revenue, 0) / 7
    const ma14 = last30Days.slice(-14).reduce((s, d) => s + d.revenue, 0) / 14
    const ma30 = last30Days.reduce((s, d) => s + d.revenue, 0) / 30

    // Trend (oxirgi 7 kun vs oldingi 7 kun)
    const last7 = last30Days.slice(-7).reduce((s, d) => s + d.revenue, 0)
    const prev7 = last30Days.slice(-14, -7).reduce((s, d) => s + d.revenue, 0)
    const trend = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0

    // Haftaning kunlari bo'yicha o'rtacha (dushanba, seshanba, ...)
    const dayOfWeekAvg: number[] = [0, 0, 0, 0, 0, 0, 0] // 0=Sunday
    const dayOfWeekCount: number[] = [0, 0, 0, 0, 0, 0, 0]
    for (const d of last30Days) {
      const day = new Date(d.date).getDay()
      dayOfWeekAvg[day] += d.revenue
      dayOfWeekCount[day]++
    }
    for (let i = 0; i < 7; i++) {
      if (dayOfWeekCount[i] > 0) {
        dayOfWeekAvg[i] = dayOfWeekAvg[i] / dayOfWeekCount[i]
      }
    }

    // Prognoz - kelgusi N kun uchun
    const forecast: Array<{ date: string; predictedRevenue: number; predictedProfit: number; confidence: number }> = []
    for (let i = 1; i <= days; i++) {
      const futureDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000)
      const dateKey = futureDate.toISOString().slice(0, 10)
      const dayOfWeek = futureDate.getDay()

      // Prognoz = max(ma7, haftaning o'sha kuni o'rtachasi) + trend adjustment
      const baseForecast = Math.max(ma7, dayOfWeekAvg[dayOfWeek])
      const trendAdjustment = baseForecast * (trend / 100) * (i / 7) // trend vaqt bilan o'sadi
      const predictedRevenue = Math.max(0, Math.round(baseForecast + trendAdjustment))

      // Foyda prognozi (odatda 30-40% marja)
      const avgProfitMargin = last30Days.slice(-7).reduce((s, d) => s + (d.revenue > 0 ? d.profit / d.revenue : 0), 0) / 7
      const predictedProfit = Math.round(predictedRevenue * avgProfitMargin)

      // Ishonch (ma'lumotlar kam bo'lsa past, ko'p bo'lsa yuqori)
      const confidence = Math.min(95, Math.round(50 + (dayOfWeekCount[dayOfWeek] * 5) + (i <= 7 ? 20 : 0)))

      forecast.push({
        date: dateKey,
        predictedRevenue,
        predictedProfit,
        confidence,
      })
    }

    // Jami prognoz
    const totalForecastRevenue = forecast.reduce((s, f) => s + f.predictedRevenue, 0)
    const totalForecastProfit = forecast.reduce((s, f) => s + f.predictedProfit, 0)

    return NextResponse.json({
      summary: {
        ma7: Math.round(ma7),
        ma14: Math.round(ma14),
        ma30: Math.round(ma30),
        trend: Math.round(trend * 10) / 10, // % o'sish yoki kamayish
        last7Revenue: Math.round(last7),
        prev7Revenue: Math.round(prev7),
        totalForecastRevenue: Math.round(totalForecastRevenue),
        totalForecastProfit: Math.round(totalForecastProfit),
        avgProfitMargin: Math.round((last30Days.slice(-7).reduce((s, d) => s + (d.revenue > 0 ? d.profit / d.revenue : 0), 0) / 7) * 100),
      },
      forecast,
      dayOfWeekAvg: dayOfWeekAvg.map(v => Math.round(v)),
      last30Days,
      insight: generateInsight(trend, ma7, ma30, dayOfWeekAvg),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function generateInsight(trend: number, ma7: number, ma30: number, dayOfWeekAvg: number[]): string {
  let insight = ''

  if (trend > 10) {
    insight += '📈 Savdo o\'sib borayapti! Bu hafta oldingi haftaga nisbatan ' + Math.round(trend) + '% ko\'proq. '
  } else if (trend < -10) {
    insight += '📉 Savdo kamayib borayapti (' + Math.round(trend) + '%). Strategiyani qayta ko\'rib chiqish kerak. '
  } else {
    insight += '➡️ Savdo barqaror. O\'zgarish: ' + Math.round(trend) + '%. '
  }

  // Eng yaxshi kun
  const maxDay = dayOfWeekAvg.indexOf(Math.max(...dayOfWeekAvg))
  const dayNames = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  if (dayOfWeekAvg[maxDay] > 0) {
    insight += `Eng yuqori savdo kuni: ${dayNames[maxDay]}. `
  }

  // O'rtacha kunlik prognoz
  if (ma7 > 0) {
    insight += `Kunlik o'rtacha: ${Math.round(ma7).toLocaleString('uz-UZ')} so'm. `
  }

  return insight
}
