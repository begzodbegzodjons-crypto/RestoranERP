import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// PUT /api/kitchen/orders/[id] - buyurtma kitchen status ini o'zgartirish
// Body: { kitchenStatus: 'cooking' | 'ready' | 'served' }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { kitchenStatus } = body

    if (!['new', 'cooking', 'ready', 'served'].includes(kitchenStatus)) {
      return NextResponse.json({ error: 'Noto\'g\'ri status' }, { status: 400 })
    }

    const order = await db.order.findFirst({
      where: { id, restaurantId: staff.restaurantId }
    })
    if (!order) return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })

    const updates: any = { kitchenStatus }
    if (kitchenStatus === 'cooking' && !order.kitchenStartedAt) {
      updates.kitchenStartedAt = new Date()
    }
    if (kitchenStatus === 'ready' && !order.kitchenReadyAt) {
      updates.kitchenReadyAt = new Date()
    }

    const updated = await db.order.update({
      where: { id },
      data: updates,
      include: {
        table: true,
        waiter: true,
        items: { include: { product: true } }
      }
    })

    // Notification to waiter when ready
    if (kitchenStatus === 'ready') {
      await db.notification.create({
        data: {
          restaurantId: staff.restaurantId,
          type: 'kitchen_ready',
          title: `Taom tayyor: ${updated.table?.name || 'Stol'}`,
          message: `Buyurtma #${updated.invoiceNo} - ofitsiant ${updated.waiter?.name} ga berishingiz mumkin`,
          audience: 'waiter',
          metadata: JSON.stringify({ orderId: id, tableId: updated.tableId })
        }
      })
    }

    return NextResponse.json({ item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
