import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/integrations/1c-export - 1C Buxgalteriya uchun XML eksport
// Soliq hisoboti uchun mo'ljallangan
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)

    const startDate = new Date(from)
    const endDate = new Date(to)
    endDate.setDate(endDate.getDate() + 1)

    // Get all sales in range
    const sales = await db.sale.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate, lt: endDate },
        status: 'completed'
      },
      include: {
        items: { include: { product: true } },
        customer: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Get expenses
    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: startDate, lt: endDate }
      }
    })

    // Get purchases
    const purchases = await db.purchase.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: { gte: startDate, lt: endDate }
      },
      include: { supplier: true, items: { include: { ingredient: true } } }
    })

    const vatRate = restaurant.vatRate || 0

    // Calculate totals
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalVAT = sales.reduce((s, x) => s + (x.total * vatRate / (100 + vatRate)), 0)
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const totalPurchases = purchases.reduce((s, x) => s + x.totalAmount, 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)

    // Generate 1C-compatible XML (CommerceML 2.0 format simplified)
    const formatDate = (d: Date) => d.toISOString().slice(0, 19)
    const escapeXml = (s: string) => s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c))

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<КоммерческаяИнформация ВерсияСхемы="2.05" ДатаФормирования="${formatDate(new Date())}">\n`

    // Restaurant info
    xml += `  <Организация>\n`
    xml += `    <Наименование>${escapeXml(restaurant.name)}</Наименование>\n`
    xml += `    <ИНН></ИНН>\n`
    xml += `    <Период С="${from}" По="${to}"/>\n`
    xml += `  </Организация>\n`

    // Summary
    xml += `  <Сводка>\n`
    xml += `    <Реализация Сумма="${totalSales.toFixed(2)}" НДС="${totalVAT.toFixed(2)}" Количество="${sales.length}"/>\n`
    xml += `    <Расходы Сумма="${totalExpenses.toFixed(2)}" Количество="${expenses.length}"/>\n`
    xml += `    <Закупки Сумма="${totalPurchases.toFixed(2)}" Количество="${purchases.length}"/>\n`
    xml += `    <Прибыль Сумма="${totalProfit.toFixed(2)}"/>\n`
    xml += `  </Сводка>\n`

    // Sales documents
    xml += `  <Документы>\n`
    for (const s of sales) {
      const vatAmount = s.total * vatRate / (100 + vatRate)
      const amountWithoutVAT = s.total - vatAmount
      xml += `    <Документ Номер="${escapeXml(s.invoiceNo)}" Дата="${formatDate(s.createdAt)}" Тип="Реализация">\n`
      xml += `      <Контрагент>${escapeXml(s.customer?.name || 'Naqd mijoz')}</Контрагент>\n`
      xml += `      <Сумма>${s.total.toFixed(2)}</Сумма>\n`
      xml += `      <БезНДС>${amountWithoutVAT.toFixed(2)}</БезНДС>\n`
      xml += `      <НДС Ставка="${vatRate}%" Сумма="${vatAmount.toFixed(2)}"/>\n`
      xml += `      <СпособОплаты>${s.paymentMethod}</СпособОплаты>\n`
      xml += `      <Товары>\n`
      for (const it of s.items) {
        xml += `        <Товар Наименование="${escapeXml(it.product.name)}" Количество="${it.quantity}" Цена="${it.unitPrice.toFixed(2)}" Сумма="${it.total.toFixed(2)}"/>\n`
      }
      xml += `      </Товары>\n`
      xml += `    </Документ>\n`
    }
    xml += `  </Документы>\n`

    // Expenses
    xml += `  <Расходы>\n`
    for (const e of expenses) {
      xml += `    <Расход Дата="${formatDate(e.date)}" Категория="${escapeXml(e.category)}" Сумма="${e.amount.toFixed(2)}" Описание="${escapeXml(e.description || '')}"/>\n`
    }
    xml += `  </Расходы>\n`

    // Purchases
    xml += `  <Закупки>\n`
    for (const p of purchases) {
      xml += `    <Закупка Номер="${escapeXml(p.invoiceNo || '')}" Дата="${formatDate(p.createdAt)}" Поставщик="${escapeXml(p.supplier?.name || '')}" Сумма="${p.totalAmount.toFixed(2)}">\n`
      for (const it of p.items) {
        xml += `      <Товар Наименование="${escapeXml(it.ingredient.name)}" Количество="${it.quantity}" Цена="${it.unitPrice.toFixed(2)}" Сумма="${it.total.toFixed(2)}"/>\n`
      }
      xml += `    </Закупка>\n`
    }
    xml += `  </Закупки>\n`

    xml += `</КоммерческаяИнформация>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="1c-export-${from}-to-${to}.xml"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
