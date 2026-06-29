import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/kitchen/orders - oshpaz uchun buyurtmalar
// ?status=new|cooking|ready|all (default: new+cooking)
export async function GET(req: Request) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'

    const where: any = {
      restaurantId: staff.restaurantId,
      status: 'open' // Only open orders (not paid/cancelled)
    }

    if (status === 'active') {
      where.kitchenStatus = { in: ['new', 'cooking'] }
    } else if (status !== 'all') {
      where.kitchenStatus = status
    }

    const orders = await db.order.findMany({
      where,
      include: {
        table: true,
        waiter: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'asc' } // FIFO - oldest first
    })

    return NextResponse.json({ items: orders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
