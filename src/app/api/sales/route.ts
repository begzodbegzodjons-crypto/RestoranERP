import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { consumeInventoryForSale, generateInvoiceNo } from '@/lib/business'

// GET /api/sales - savdo tarixi
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const items = await db.sale.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        items: { include: { product: true } },
        table: true,
        customer: true,
        staff: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/sales - yangi savdo yaratish (POS)
// Body: { items: [{ productId, quantity }], tableId?, customerId?, staffId?, discount?, paymentMethod? }
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { items, tableId, customerId, staffId, discount = 0, paymentMethod = 'cash', notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Kamida bitta mahsulot kerak' }, { status: 400 })
    }

    // Validate products and gather pricing
    let subtotal = 0
    let totalCost = 0
    const saleItemsData: any[] = []

    for (const it of items) {
      const product = await db.product.findFirst({
        where: { id: it.productId, restaurantId: restaurant.id },
        include: { recipes: true }
      })
      if (!product) return NextResponse.json({ error: `Mahsulot topilmadi: ${it.productId}` }, { status: 400 })

      const qty = parseFloat(it.quantity)
      const lineTotal = product.price * qty
      const lineCost = product.cost * qty

      subtotal += lineTotal
      totalCost += lineCost

      saleItemsData.push({
        productId: product.id,
        quantity: qty,
        unitPrice: product.price,
        unitCost: product.cost,
        total: lineTotal,
        totalCost: lineCost
      })
    }

    const discountAmount = parseFloat(discount) || 0
    const taxAmount = (subtotal - discountAmount) * (restaurant.taxRate / 100)
    const total = subtotal - discountAmount + taxAmount
    const profit = total - totalCost

    // Create sale
    const sale = await db.sale.create({
      data: {
        restaurantId: restaurant.id,
        invoiceNo: generateInvoiceNo('INV'),
        tableId: tableId || null,
        customerId: customerId || null,
        staffId: staffId || null,
        subtotal,
        discount: discountAmount,
        taxAmount,
        total,
        paidAmount: total,
        paymentMethod,
        status: 'completed',
        costOfGoods: totalCost,
        profit,
        notes: notes || null,
        items: { create: saleItemsData }
      },
      include: { items: { include: { product: true } } }
    })

    // Reduce inventory for each product's recipe
    for (const it of items) {
      await consumeInventoryForSale(restaurant.id, it.productId, parseFloat(it.quantity))
    }

    // Update customer stats
    if (customerId) {
      await db.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: total }
        }
      })
    }

    // Update table status
    if (tableId) {
      await db.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'free' }
      })
    }

    return NextResponse.json({ item: sale })
  } catch (e: any) {
    console.error('Sale error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
