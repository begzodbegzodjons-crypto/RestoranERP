import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'
import { generateInvoiceNo, consumeInventoryForSale } from '@/lib/business'

// GET /api/staff/orders - ofitsiant/kassir uchun buyurtmalar ro'yxati
// ?status=open|paid|all (default: open)
export async function GET(req: Request) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'open'

    const orders = await db.order.findMany({
      where: {
        restaurantId: staff.restaurantId,
        ...(status !== 'all' ? { status } : {})
      },
      include: {
        table: true,
        waiter: true,
        cashier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ items: orders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/staff/orders - ofitsiant yangi buyurtma yuboradi
// Body: { tableId, items: [{ productId, quantity, notes }] }
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Only waiters and managers can create orders
    if (staff.position !== 'waiter' && staff.position !== 'manager') {
      return NextResponse.json({ error: 'Faqat ofitsiant buyurtma yuborishi mumkin' }, { status: 403 })
    }

    const body = await req.json()
    const { tableId, items } = body

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Stol va mahsulotlar kerak' }, { status: 400 })
    }

    // Verify table belongs to restaurant
    const table = await db.restaurantTable.findFirst({
      where: { id: tableId, restaurantId: staff.restaurantId }
    })
    if (!table) return NextResponse.json({ error: 'Stol topilmadi' }, { status: 404 })

    // Validate products and calculate
    let subtotal = 0
    const itemsData: any[] = []

    for (const it of items) {
      const product = await db.product.findFirst({
        where: { id: it.productId, restaurantId: staff.restaurantId }
      })
      if (!product) {
        return NextResponse.json({ error: `Mahsulot topilmadi: ${it.productId}` }, { status: 400 })
      }
      if (!product.isAvailable) {
        return NextResponse.json({ error: `${product.name} hozircha mavjud emas` }, { status: 400 })
      }

      const qty = parseFloat(it.quantity)
      const lineTotal = product.price * qty
      const lineCost = product.cost * qty

      subtotal += lineTotal
      itemsData.push({
        productId: product.id,
        quantity: qty,
        unitPrice: product.price,
        unitCost: product.cost,
        total: lineTotal,
        totalCost: lineCost,
        notes: it.notes || null
      })
    }

    // Check if there's already an open order for this table
    const existingOrder = await db.order.findFirst({
      where: { tableId, restaurantId: staff.restaurantId, status: 'open' },
      include: { items: true }
    })

    if (existingOrder) {
      // Add items to existing order
      await db.orderItem.createMany({
        data: itemsData.map(it => ({ ...it, orderId: existingOrder.id }))
      })

      const newSubtotal = existingOrder.subtotal + subtotal
      const serviceCharge = newSubtotal * (staff.restaurant.serviceChargePercent / 100)
      const newTotal = newSubtotal + serviceCharge - existingOrder.discount

      const updated = await db.order.update({
        where: { id: existingOrder.id },
        data: {
          subtotal: newSubtotal,
          serviceChargePercent: staff.restaurant.serviceChargePercent,
          serviceChargeAmount: serviceCharge,
          total: newTotal
        },
        include: {
          table: true,
          waiter: true,
          items: { include: { product: true } }
        }
      })

      // Mark table as occupied
      await db.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'occupied' }
      })

      return NextResponse.json({ item: updated, added: true })
    }

    // Create new order
    const serviceCharge = subtotal * (staff.restaurant.serviceChargePercent / 100)
    const total = subtotal + serviceCharge

    const order = await db.order.create({
      data: {
        restaurantId: staff.restaurantId,
        tableId,
        waiterId: staff.id,
        status: 'open',
        invoiceNo: generateInvoiceNo('ORD'),
        subtotal,
        serviceChargePercent: staff.restaurant.serviceChargePercent,
        serviceChargeAmount: serviceCharge,
        total,
        items: { create: itemsData }
      },
      include: {
        table: true,
        waiter: true,
        items: { include: { product: true } }
      }
    })

    // Mark table as occupied
    await db.restaurantTable.update({
      where: { id: tableId },
      data: { status: 'occupied' }
    })

    return NextResponse.json({ item: order })
  } catch (e: any) {
    console.error('Order create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
