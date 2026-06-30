import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reports - TO'LIQ hisob-kitob (barcha ma'lumotlar)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date()
    // Extend 'to' to end of day
    to.setHours(23, 59, 59, 999)

    // ============ SALES ============
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: from, lte: to },
        status: 'completed'
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
        staff: true,
        table: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // ============ EXPENSES ============
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: from, lte: to }
      },
      orderBy: { date: 'desc' }
    })

    // ============ PURCHASES (KIRIM) ============
    const purchases = await db.purchase.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: from, lte: to }
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
      orderBy: { createdAt: 'desc' }
    })

    // ============ INVENTORY (OMBOR) - joriy holat ============
    const ingredients = await db.ingredient.findMany({
      where: { restaurantId: restaurant.id },
      include: { supplier: true }
    })

    const inventoryValue = ingredients.reduce((s, i) => s + i.stock * i.unitPrice, 0)
    const lowStockItems = ingredients.filter(i => i.stock <= i.minStock)

    // ============ PRODUCTS (TAOMLAR) ============
    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id },
      include: { category: true }
    })

    // ============ AGGREGATIONS ============
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const totalCost = sales.reduce((s, x) => s + x.costOfGoods, 0)
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const totalPurchases = purchases.reduce((s, x) => s + x.totalAmount, 0)
    const netProfit = totalProfit - totalExpenses

    // By category
    const categoryMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
    for (const sale of sales) {
      for (const item of sale.items) {
        const catName = item.product.category?.name || 'Boshqa'
        const existing = categoryMap.get(catName) || { name: catName, qty: 0, revenue: 0, profit: 0 }
        existing.qty += item.quantity
        existing.revenue += item.total
        existing.profit += (item.total - item.totalCost)
        categoryMap.set(catName, existing)
      }
    }
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)

    // By product
    const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
    for (const sale of sales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productId) || { name: item.product.name, qty: 0, revenue: 0, profit: 0 }
        existing.qty += item.quantity
        existing.revenue += item.total
        existing.profit += (item.total - item.totalCost)
        productMap.set(item.productId, existing)
      }
    }
    const byProduct = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue)

    // By payment method
    const paymentMap = new Map<string, number>()
    for (const sale of sales) {
      paymentMap.set(sale.paymentMethod, (paymentMap.get(sale.paymentMethod) || 0) + sale.total)
    }
    const byPayment = Array.from(paymentMap.entries()).map(([method, total]) => ({ method, total }))

    // Daily breakdown
    const dayMap = new Map<string, { date: string; sales: number; profit: number; orders: number }>()
    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10)
      const existing = dayMap.get(key) || { date: key, sales: 0, profit: 0, orders: 0 }
      existing.sales += sale.total
      existing.profit += sale.profit
      existing.orders += 1
      dayMap.set(key, existing)
    }
    const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // By waiter (ofitsiant)
    const waiterMap = new Map<string, { name: string; orders: number; revenue: number; profit: number }>()
    for (const sale of sales) {
      if (!sale.staff) continue
      const existing = waiterMap.get(sale.staffId!) || { name: sale.staff.name, orders: 0, revenue: 0, profit: 0 }
      existing.orders += 1
      existing.revenue += sale.total
      existing.profit += sale.profit
      waiterMap.set(sale.staffId!, existing)
    }
    const byWaiter = Array.from(waiterMap.values()).sort((a, b) => b.revenue - a.revenue)

    // By table (stol)
    const tableMap = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const sale of sales) {
      if (!sale.table) continue
      const existing = tableMap.get(sale.tableId!) || { name: sale.table.name, orders: 0, revenue: 0 }
      existing.orders += 1
      existing.revenue += sale.total
      tableMap.set(sale.tableId!, existing)
    }
    const byTable = Array.from(tableMap.values()).sort((a, b) => b.revenue - a.revenue)

    // Expenses by category
    const expenseCatMap = new Map<string, number>()
    for (const e of expenses) {
      expenseCatMap.set(e.category, (expenseCatMap.get(e.category) || 0) + e.amount)
    }
    const expensesByCategory = Array.from(expenseCatMap.entries()).map(([category, amount]) => ({ category, amount }))

    // Purchases by supplier
    const supplierMap = new Map<string, { name: string; amount: number; count: number }>()
    for (const p of purchases) {
      const name = p.supplier?.name || 'Yetkazib beruvchisiz'
      const existing = supplierMap.get(name) || { name, amount: 0, count: 0 }
      existing.amount += p.totalAmount
      existing.count += 1
      supplierMap.set(name, existing)
    }
    const purchasesBySupplier = Array.from(supplierMap.values()).sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      range: { from, to },
      summary: {
        totalSales,
        totalProfit,
        totalCost,
        totalExpenses,
        totalPurchases,
        netProfit,
        orderCount: sales.length,
        avgOrder: sales.length > 0 ? totalSales / sales.length : 0,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        inventoryValue,
        inventoryItems: ingredients.length,
        lowStockCount: lowStockItems.length,
        productCount: products.length
      },
      byCategory,
      byProduct,
      byPayment,
      byDay,
      byWaiter,
      byTable,
      expensesByCategory,
      purchasesBySupplier,
      recentSales: sales.slice(0, 50).map(s => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        createdAt: s.createdAt,
        total: s.total,
        profit: s.profit,
        costOfGoods: s.costOfGoods,
        paymentMethod: s.paymentMethod,
        itemCount: s.items.length,
        waiterName: s.staff?.name || null,
        tableName: s.table?.name || null,
        kassir: s.notes?.includes('Kassir:') ? s.notes.split('Kassir:')[1].trim() : null,
        items: s.items.map(it => ({ name: it.product.name, qty: it.quantity, price: it.unitPrice, total: it.total }))
      })),
      allExpenses: expenses.map(e => ({
        id: e.id,
        category: e.category,
        amount: e.amount,
        description: e.description,
        date: e.date
      })),
      allPurchases: purchases.map(p => ({
        id: p.id,
        invoiceNo: p.invoiceNo,
        supplier: p.supplier?.name || '—',
        totalAmount: p.totalAmount,
        createdAt: p.createdAt,
        itemCount: p.items.length,
        items: p.items.map(it => ({ name: it.ingredient.name, qty: it.quantity, unit: it.unit, price: it.unitPrice, total: it.total }))
      })),
      inventory: ingredients.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        stock: i.stock,
        unitPrice: i.unitPrice,
        totalValue: i.stock * i.unitPrice,
        minStock: i.minStock,
        isLowStock: i.stock <= i.minStock,
        supplier: i.supplier?.name || null
      })),
      lowStockItems: lowStockItems.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        stock: i.stock,
        minStock: i.minStock
      }))
    })
  } catch (e: any) {
    console.error('Reports error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
