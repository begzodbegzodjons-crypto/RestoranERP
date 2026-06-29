import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// POST /api/shifts/close - smena yopish (Z-otchet)
// Body: { closingCash: number, notes?: string }
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    if (staff.position !== 'cashier' && staff.position !== 'manager') {
      return NextResponse.json({ error: 'Faqat kassir smena yopa oladi' }, { status: 403 })
    }

    const body = await req.json()
    const closingCash = parseFloat(body.closingCash) || 0
    const notes = body.notes || null

    // Find open shift
    const shift = await db.shift.findFirst({
      where: { restaurantId: staff.restaurantId, status: 'open' }
    })
    if (!shift) {
      return NextResponse.json({ error: 'Ochiq smena topilmadi' }, { status: 404 })
    }

    // Calculate totals from sales during this shift
    const sales = await db.sale.findMany({
      where: {
        restaurantId: staff.restaurantId,
        createdAt: { gte: shift.openedAt },
        status: 'completed'
      },
      select: { total: true, paymentMethod: true }
    })

    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
    const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0)
    const transferSales = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0)

    // Expected cash = opening + cash sales
    const expectedCash = shift.openingCash + cashSales
    const cashDiff = closingCash - expectedCash

    const updated = await db.shift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closingCash,
        expectedCash,
        cashDiff,
        totalSales,
        cashSales,
        cardSales,
        transferSales,
        orderCount: sales.length,
        closedAt: new Date(),
        notes
      },
      include: { staff: true }
    })

    // Create notification
    await db.notification.create({
      data: {
        restaurantId: staff.restaurantId,
        type: 'shift_closed',
        title: `Smena yopildi: ${staff.name}`,
        message: `Jami savdo: ${totalSales.toLocaleString()} UZS, Naqd: ${cashSales.toLocaleString()}, Karta: ${cardSales.toLocaleString()}, Farq: ${cashDiff >= 0 ? '+' : ''}${cashDiff.toLocaleString()}`,
        audience: 'admin'
      }
    })

    return NextResponse.json({
      item: updated,
      zReport: {
        shiftId: updated.id,
        cashier: staff.name,
        openedAt: updated.openedAt,
        closedAt: updated.closedAt,
        openingCash: updated.openingCash,
        cashSales: updated.cashSales,
        cardSales: updated.cardSales,
        transferSales: updated.transferSales,
        totalSales: updated.totalSales,
        expectedCash: updated.expectedCash,
        closingCash: updated.closingCash,
        cashDiff: updated.cashDiff,
        orderCount: updated.orderCount
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
