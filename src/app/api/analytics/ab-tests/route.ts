import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/analytics/ab-tests - narx o'zgartirish ta'siri tahlili
// Avtomatik: mahsulot narxi o'zgartirilgan sanani topib,
// o'sha sanadan oldin va keyin savdoni solishtiradi
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Get all products with their updatedAt (price change date)
    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { updatedAt: 'desc' }
    })

    const results = []

    for (const p of products) {
      // Skip if product is very new (< 14 days old)
      const age = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      if (age < 14) continue

      // Compare updatedAt (recent price change) - we don't store old price
      // So we compare: 14 days before updatedAt vs 14 days after updatedAt
      const changeDate = p.updatedAt
      const beforeStart = new Date(changeDate)
      beforeStart.setDate(beforeStart.getDate() - 14)
      const afterEnd = new Date(changeDate)
      afterEnd.setDate(afterEnd.getDate() + 14)

      // Skip if change is too recent (< 7 days ago)
      const daysSinceChange = (Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceChange < 7) continue

      // Get sales before
      const beforeSales = await db.saleItem.findMany({
        where: {
          productId: p.id,
          sale: {
            restaurantId: restaurant.id,
            createdAt: { gte: beforeStart, lt: changeDate },
            status: 'completed'
          }
        },
        select: { quantity: true, total: true, unitPrice: true }
      })

      // Get sales after
      const afterSales = await db.saleItem.findMany({
        where: {
          productId: p.id,
          sale: {
            restaurantId: restaurant.id,
            createdAt: { gte: changeDate, lt: afterEnd },
            status: 'completed'
          }
        },
        select: { quantity: true, total: true, unitPrice: true }
      })

      if (beforeSales.length === 0 && afterSales.length === 0) continue

      const beforeQty = beforeSales.reduce((s, x) => s + x.quantity, 0)
      const afterQty = afterSales.reduce((s, x) => s + x.quantity, 0)
      const beforeRevenue = beforeSales.reduce((s, x) => s + x.total, 0)
      const afterRevenue = afterSales.reduce((s, x) => s + x.total, 0)
      const beforeAvgPrice = beforeQty > 0 ? beforeRevenue / beforeQty : 0
      const afterAvgPrice = afterQty > 0 ? afterRevenue / afterQty : 0

      // Price change percent
      const priceChange = beforeAvgPrice > 0 ? ((afterAvgPrice - beforeAvgPrice) / beforeAvgPrice) * 100 : 0
      // Quantity change percent
      const qtyChange = beforeQty > 0 ? ((afterQty - beforeQty) / beforeQty) * 100 : (afterQty > 0 ? 100 : 0)
      // Revenue change percent
      const revenueChange = beforeRevenue > 0 ? ((afterRevenue - beforeRevenue) / beforeRevenue) * 100 : (afterRevenue > 0 ? 100 : 0)

      // Demand elasticity: % change in qty / % change in price
      const elasticity = priceChange !== 0 ? qtyChange / priceChange : 0

      // Recommendation
      let recommendation = ''
      let recommendationType = 'neutral'
      if (priceChange > 0 && revenueChange > 0) {
        recommendation = `Narx ${priceChange.toFixed(1)}% oshdi, daromad ${revenueChange.toFixed(1)}% o'sdi. Narx oshirish foydali bo'ldi.`
        recommendationType = 'success'
      } else if (priceChange > 0 && revenueChange < 0) {
        recommendation = `Narx ${priceChange.toFixed(1)}% oshdi, lekin daromad ${Math.abs(revenueChange).toFixed(1)}% kamaydi. Narxni pasaytirish tavsiya etiladi.`
        recommendationType = 'danger'
      } else if (priceChange < 0 && revenueChange > 0) {
        recommendation = `Narx ${Math.abs(priceChange).toFixed(1)}% kamaydi, daromad ${revenueChange.toFixed(1)}% o'sdi. Chegirma ishladi!`
        recommendationType = 'success'
      } else if (priceChange < 0 && revenueChange < 0) {
        recommendation = `Narx ${Math.abs(priceChange).toFixed(1)}% kamaydi, daromad ham ${Math.abs(revenueChange).toFixed(1)}% kamaydi. Chegirma samara bermadi.`
        recommendationType = 'warning'
      } else {
        recommendation = `Juda kam ma'lumot. Ko'proq savdo kerak.`
        recommendationType = 'neutral'
      }

      results.push({
        productId: p.id,
        productName: p.name,
        currentPrice: p.price,
        changeDate,
        before: {
          period: `${beforeStart.toLocaleDateString('uz-UZ')} - ${changeDate.toLocaleDateString('uz-UZ')}`,
          qty: beforeQty,
          revenue: beforeRevenue,
          avgPrice: beforeAvgPrice
        },
        after: {
          period: `${changeDate.toLocaleDateString('uz-UZ')} - ${afterEnd.toLocaleDateString('uz-UZ')}`,
          qty: afterQty,
          revenue: afterRevenue,
          avgPrice: afterAvgPrice
        },
        priceChange,
        qtyChange,
        revenueChange,
        elasticity,
        recommendation,
        recommendationType
      })
    }

    // Sort by absolute revenue impact
    results.sort((a, b) => Math.abs(b.revenueChange) - Math.abs(a.revenueChange))

    return NextResponse.json({
      summary: {
        totalProductsAnalyzed: results.length,
        positiveImpact: results.filter(r => r.revenueChange > 0).length,
        negativeImpact: results.filter(r => r.revenueChange < 0).length
      },
      results
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
