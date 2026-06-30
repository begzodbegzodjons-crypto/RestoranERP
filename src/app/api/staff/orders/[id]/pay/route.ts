import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'
import { generateInvoiceNo, consumeInventoryForSale } from '@/lib/business'

// POST /api/staff/orders/[id]/pay - kassir to'lovni qabul qiladi
// Body: { paymentMethod: 'cash'|'card'|'transfer', discount?: number }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Only cashiers and managers can accept payment
    if (staff.position !== 'cashier' && staff.position !== 'manager') {
      return NextResponse.json({ error: 'Faqat kassir to\'lov qabul qila oladi' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { paymentMethod = 'cash', discount = 0 } = body

    const order = await db.order.findFirst({
      where: { id, restaurantId: staff.restaurantId },
      include: { items: true, table: true, waiter: true }
    })
    if (!order) return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })

    if (order.status !== 'open') {
      return NextResponse.json({ error: 'Buyurtma allaqachon yopilgan' }, { status: 400 })
    }

    const discountAmount = parseFloat(discount) || 0
    const serviceCharge = order.subtotal * (order.serviceChargePercent / 100)
    const finalTotal = order.subtotal + serviceCharge - discountAmount

    if (finalTotal < 0) {
      return NextResponse.json({ error: 'Yakuniy summa manfiy bo\'lmasin' }, { status: 400 })
    }

    // Update order
    const updated = await db.order.update({
      where: { id },
      data: {
        status: 'paid',
        cashierId: staff.id,
        paymentMethod,
        discount: discountAmount,
        total: finalTotal,
        paidAt: new Date(),
        invoiceNo: generateInvoiceNo('INV')
      },
      include: {
        table: true,
        waiter: true,
        cashier: true,
        items: { include: { product: true } }
      }
    })

    // Create Sale record (ERP sales history)
    const totalCost = order.items.reduce((s, it) => s + it.totalCost, 0)
    const profit = finalTotal - totalCost - serviceCharge // service charge is not profit, it's a fee collected

    const sale = await db.sale.create({
      data: {
        restaurantId: staff.restaurantId,
        invoiceNo: updated.invoiceNo,
        tableId: order.tableId,
        staffId: order.waiterId, // waiter who served
        subtotal: order.subtotal,
        discount: discountAmount,
        taxAmount: serviceCharge, // service charge recorded as tax-like
        total: finalTotal,
        paidAmount: finalTotal,
        paymentMethod,
        status: 'completed',
        costOfGoods: totalCost,
        profit: profit > 0 ? profit : 0,
        notes: `Order: ${order.invoiceNo}, Kassir: ${staff.name}`,
        items: {
          create: order.items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCost: it.unitCost,
            total: it.total,
            totalCost: it.totalCost
          }))
        }
      }
    })

    // Consume inventory
    for (const it of order.items) {
      await consumeInventoryForSale(staff.restaurantId, it.productId, it.quantity)
    }

    // Free the table
    await db.restaurantTable.update({
      where: { id: order.tableId },
      data: { status: 'free' }
    })

    return NextResponse.json({
      success: true,
      order: updated,
      saleId: sale.id,
      message: 'To\'lov qabul qilindi. Chek chop etish tayyor.'
    })
  } catch (e: any) {
    console.error('Pay error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
