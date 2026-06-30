import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/shifts/current - joriy ochiq smena
export async function GET() {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const shift = await db.shift.findFirst({
      where: { restaurantId: staff.restaurantId, status: 'open' },
      include: { staff: true }
    })

    if (!shift) {
      return NextResponse.json({ shift: null })
    }

    // Live totals
    const sales = await db.sale.findMany({
      where: {
        restaurantId: staff.restaurantId,
        createdAt: { gte: shift.openedAt },
        status: 'completed'
      },
      select: { total: true, paymentMethod: true }
    })

    return NextResponse.json({
      shift,
      live: {
        totalSales: sales.reduce((s, x) => s + x.total, 0),
        cashSales: sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0),
        cardSales: sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0),
        transferSales: sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0),
        orderCount: sales.length,
        expectedCash: shift.openingCash + sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
