import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/staff/tables - stollar ro'yxati (status bilan)
export async function GET() {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const tables = await db.restaurantTable.findMany({
      where: { restaurantId: staff.restaurantId },
      orderBy: { name: 'asc' }
    })

    // For each table, check if it has an open order
    const tablesWithOrders = await Promise.all(
      tables.map(async t => {
        const openOrder = await db.order.findFirst({
          where: { tableId: t.id, status: 'open' },
          include: {
            items: { include: { product: true } },
            waiter: true
          }
        })
        return {
          ...t,
          openOrder: openOrder ? {
            id: openOrder.id,
            invoiceNo: openOrder.invoiceNo,
            total: openOrder.total,
            subtotal: openOrder.subtotal,
            serviceCharge: openOrder.serviceChargeAmount,
            itemsCount: openOrder.items.length,
            items: openOrder.items,
            waiterName: openOrder.waiter.name,
            createdAt: openOrder.createdAt
          } : null
        }
      })
    )

    return NextResponse.json({ items: tablesWithOrders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
