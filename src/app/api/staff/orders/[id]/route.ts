import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/staff/orders/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const order = await db.order.findFirst({
      where: { id, restaurantId: staff.restaurantId },
      include: {
        table: true,
        waiter: true,
        cashier: true,
        items: { include: { product: true } }
      }
    })
    if (!order) return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })

    return NextResponse.json({ item: order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - cancel order
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const order = await db.order.findFirst({
      where: { id, restaurantId: staff.restaurantId }
    })
    if (!order) return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })

    if (order.status === 'paid') {
      return NextResponse.json({ error: 'To\'langan buyurtmani o\'chirib bo\'lmaydi' }, { status: 400 })
    }

    await db.order.update({
      where: { id },
      data: { status: 'cancelled' }
    })

    // Free the table if no other open orders
    const otherOpenOrders = await db.order.count({
      where: { tableId: order.tableId, status: 'open', id: { not: id } }
    })
    if (otherOpenOrders === 0) {
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'free' }
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
