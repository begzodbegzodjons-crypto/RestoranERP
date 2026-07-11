import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/export/1c - 1C buxgalteriya uchun eksport (JSON/XML format)
// Query params: type=sales|products|customers&from&to
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'sales'
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const toDate = to ? new Date(to) : new Date()

    if (type === 'sales') {
      // 1C uchun savdo eksporti
      const sales = await db.sale.findMany({
        where: {
          restaurantId: restaurant.id,
          createdAt: { gte: fromDate, lte: toDate },
          status: { in: ['completed', 'partial_refund'] }
        },
        include: {
          items: { include: { product: true } },
          customer: true,
        }
      })

      // 1C format (soddalashtirilgan)
      const export1C = {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          inn: restaurant.email, // INN o'rniga email (keyinchalik INN maydon qo'shsa)
        },
        period: { from: fromDate, to: toDate },
        sales: sales.map((s: any) => ({
          id: s.id,
          date: s.createdAt,
          invoiceNo: s.invoiceNo,
          customer: s.customer ? {
            name: s.customer.name,
            phone: s.customer.phone,
          } : null,
          items: s.items.map((si: any) => ({
            product: si.product.name,
            quantity: si.quantity,
            unit: si.product.unit,
            price: si.unitPrice,
            total: si.total,
            cost: si.unitCost,
          })),
          subtotal: s.subtotal,
          discount: s.discount,
          taxAmount: s.taxAmount,
          total: s.total,
          paymentMethod: s.paymentMethod,
          status: s.status,
        })),
        summary: {
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum: number, s: any) => sum + s.total, 0),
          totalTax: sales.reduce((sum: number, s: any) => sum + s.taxAmount, 0),
        }
      }

      return NextResponse.json(export1C, {
        headers: {
          'Content-Disposition': `attachment; filename="sales_1c_${fromDate.toISOString().slice(0,10)}_${toDate.toISOString().slice(0,10)}.json"`
        }
      })
    }

    if (type === 'products') {
      // 1C uchun mahsulot eksporti
      const products = await db.product.findMany({
        where: { restaurantId: restaurant.id },
        include: { category: true }
      })

      const export1C = {
        restaurant: { id: restaurant.id, name: restaurant.name },
        products: products.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category?.name || '',
          price: p.price,
          cost: p.cost,
          unit: p.unit,
          isAvailable: p.isAvailable,
        })),
      }

      return NextResponse.json(export1C, {
        headers: {
          'Content-Disposition': `attachment; filename="products_1c.json"`
        }
      })
    }

    if (type === 'customers') {
      // 1C uchun mijozlar eksporti
      const customers = await db.customer.findMany({
        where: { restaurantId: restaurant.id }
      })

      const export1C = {
        restaurant: { id: restaurant.id, name: restaurant.name },
        customers: customers.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          totalOrders: c.totalOrders,
          totalSpent: c.totalSpent,
          loyaltyPoints: c.loyaltyPoints,
          loyaltyTier: c.loyaltyTier,
        })),
      }

      return NextResponse.json(export1C, {
        headers: {
          'Content-Disposition': `attachment; filename="customers_1c.json"`
        }
      })
    }

    return NextResponse.json({ error: 'Noma\'lum type. sales | products | customers ishlatish' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
