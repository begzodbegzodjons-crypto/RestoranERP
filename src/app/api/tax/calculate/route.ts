import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/tax/calculate - soliq hisobi
// Query params: from, to (sana oralig'i)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const to = searchParams.get('to') || new Date().toISOString()

    const fromDate = new Date(from)
    const toDate = new Date(to)

    // Savdolarni olish
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: fromDate, lte: toDate },
        status: { in: ['completed', 'partial_refund'] }
      },
      select: {
        total: true,
        taxAmount: true,
        discount: true,
        refundedAmount: true,
        paymentMethod: true,
      }
    })

    // QQS stavkasi (restoran sozlamasidan)
    const vatRate = restaurant.vatRate || 0.12 // 12% default
    // Foyda solig'i stavkasi (O'zbekistonda 15% korxonalar uchun, lekin mikrokoronalar uchun 0%)
    const profitTaxRate = 0.15

    // Hisob-kitob
    let totalRevenue = 0      // Umumiy tushum (QQS dan tashqari)
    let totalTaxCollected = 0 // Yig'ilgan QQS
    let totalRefunded = 0     // Qaytarilgan
    let totalDiscount = 0     // Chegirmalar
    let taxableRevenue = 0    // Soliqqa tortiladigan tushum

    // To'lov usullari bo'yicha
    const byPaymentMethod: Record<string, { count: number; total: number; tax: number }> = {
      cash: { count: 0, total: 0, tax: 0 },
      card: { count: 0, total: 0, tax: 0 },
      transfer: { count: 0, total: 0, tax: 0 },
    }

    for (const sale of sales) {
      const netTotal = sale.total - sale.refundedAmount
      totalRevenue += netTotal
      totalTaxCollected += sale.taxAmount
      totalRefunded += sale.refundedAmount
      totalDiscount += sale.discount
      taxableRevenue += netTotal - sale.taxAmount

      const method = sale.paymentMethod in byPaymentMethod ? sale.paymentMethod : 'cash'
      byPaymentMethod[method].count++
      byPaymentMethod[method].total += netTotal
      byPaymentMethod[method].tax += sale.taxAmount
    }

    // Xarajatlar (asosiy vositalar, ish haqi, kommunal)
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: fromDate, lte: toDate }
      },
      select: { amount: true, category: true }
    })

    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)
    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount
    }

    // Sof foyda = tushum - QQS - xarajatlar
    const netProfit = taxableRevenue - totalExpenses
    // Foyda solig'i
    const profitTax = netProfit > 0 ? netProfit * profitTaxRate : 0
    // Jami soliq = QQS + foyda solig'i
    const totalTax = totalTaxCollected + profitTax

    return NextResponse.json({
      period: { from: fromDate, to: toDate },
      vatRate,
      profitTaxRate,
      summary: {
        totalRevenue: Math.round(totalRevenue),
        taxableRevenue: Math.round(taxableRevenue),
        totalTaxCollected: Math.round(totalTaxCollected), // QQS (12%)
        totalRefunded: Math.round(totalRefunded),
        totalDiscount: Math.round(totalDiscount),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        profitTax: Math.round(profitTax), // Foyda solig'i (15%)
        totalTax: Math.round(totalTax),   // Jami soliq
        netAfterTax: Math.round(netProfit - profitTax),
      },
      byPaymentMethod,
      expensesByCategory,
      salesCount: sales.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
