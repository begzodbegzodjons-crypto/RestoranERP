import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/financial-reports - Moliyaviy hisobotlar (P&L, Cash Flow)
// Query params: type=pl|cashflow|balance&from&to
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'pl'
    const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const to = searchParams.get('to') || new Date().toISOString()

    const fromDate = new Date(from)
    const toDate = new Date(to)

    // === DAROMAD ===
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
        costOfGoods: true,
        profit: true,
        refundedAmount: true,
        paymentMethod: true,
        tipAmount: true,
      }
    })

    const totalRevenue = sales.reduce((s: number, sale: any) => s + (sale.total - sale.refundedAmount), 0)
    const totalCOGS = sales.reduce((s: number, sale: any) => s + sale.costOfGoods, 0)
    const grossProfit = totalRevenue - totalCOGS - sales.reduce((s: number, sale: any) => s + sale.taxAmount, 0)
    const tips = sales.reduce((s: number, sale: any) => s + sale.tipAmount, 0)

    // === XARAJATLAR ===
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: fromDate, lte: toDate }
      },
      select: { amount: true, category: true }
    })

    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount
    }
    const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0)

    // === KOMISSIYALAR ===
    const commissions = await db.staffCommission.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: { amount: true, type: true }
    })
    const totalCommissions = commissions.reduce((s: number, c: any) => s + c.amount, 0)

    // === BRAK/ISROF ===
    const wastes = await db.waste.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: { cost: true }
    })
    const totalWasteCost = wastes.reduce((s: number, w: any) => s + w.cost, 0)

    // === CASH FLOW (to'lov usullari bo'yicha) ===
    const cashFromSales = sales.filter((s: any) => s.paymentMethod === 'cash').reduce((s: number, sale: any) => s + (sale.total - sale.refundedAmount), 0)
    const cardFromSales = sales.filter((s: any) => s.paymentMethod === 'card').reduce((s: number, sale: any) => s + (sale.total - sale.refundedAmount), 0)
    const transferFromSales = sales.filter((s: any) => s.paymentMethod === 'transfer').reduce((s: number, sale: any) => s + (sale.total - sale.refundedAmount), 0)

    // === HISOB TURLARI ===
    if (type === 'pl') {
      // Profit & Loss Statement (Foyda va zarar hisoboti)
      return NextResponse.json({
        type: 'pl',
        period: { from: fromDate, to: toDate },
        revenue: {
          salesRevenue: Math.round(totalRevenue),
          tips: Math.round(tips),
          totalRevenue: Math.round(totalRevenue + tips),
        },
        costOfGoodsSold: Math.round(totalCOGS),
        grossProfit: Math.round(grossProfit),
        operatingExpenses: {
          byCategory: expensesByCategory,
          total: Math.round(totalExpenses),
        },
        staffCommissions: Math.round(totalCommissions),
        wasteCost: Math.round(totalWasteCost),
        operatingProfit: Math.round(grossProfit - totalExpenses - totalCommissions - totalWasteCost),
        netProfit: Math.round(grossProfit - totalExpenses - totalCommissions - totalWasteCost),
      })
    }

    if (type === 'cashflow') {
      // Cash Flow Statement (Pul oqimi hisoboti)
      return NextResponse.json({
        type: 'cashflow',
        period: { from: fromDate, to: toDate },
        operatingActivities: {
          cashFromSales: {
            cash: Math.round(cashFromSales),
            card: Math.round(cardFromSales),
            transfer: Math.round(transferFromSales),
            total: Math.round(totalRevenue),
          },
          cashPaidToSuppliers: Math.round(-totalCOGS),
          cashPaidForExpenses: Math.round(-totalExpenses),
          cashPaidForCommissions: Math.round(-totalCommissions),
          netCashFromOperations: Math.round(totalRevenue - totalCOGS - totalExpenses - totalCommissions),
        },
        netCashFlow: Math.round(totalRevenue - totalCOGS - totalExpenses - totalCommissions),
      })
    }

    // default: summary
    return NextResponse.json({
      type: 'summary',
      period: { from: fromDate, to: toDate },
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalCOGS: Math.round(totalCOGS),
        grossProfit: Math.round(grossProfit),
        totalExpenses: Math.round(totalExpenses),
        totalCommissions: Math.round(totalCommissions),
        totalWasteCost: Math.round(totalWasteCost),
        netProfit: Math.round(grossProfit - totalExpenses - totalCommissions - totalWasteCost),
        profitMargin: totalRevenue > 0 ? Math.round(((grossProfit - totalExpenses - totalCommissions - totalWasteCost) / totalRevenue) * 100) : 0,
      },
      salesCount: sales.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
