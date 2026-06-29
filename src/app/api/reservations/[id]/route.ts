import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// PUT /api/reservations/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await db.reservation.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const updated = await db.reservation.update({
      where: { id },
      data: {
        customerName: body.customerName,
        phone: body.phone,
        partySize: parseInt(body.partySize) || existing.partySize,
        reservationDate: body.reservationDate ? new Date(body.reservationDate) : undefined,
        reservationTime: body.reservationTime,
        tableId: body.tableId || null,
        status: body.status,
        notes: body.notes
      },
      include: { table: true }
    })

    // If status = seated, mark table as occupied
    if (body.status === 'seated' && updated.tableId) {
      await db.restaurantTable.update({
        where: { id: updated.tableId },
        data: { status: 'occupied' }
      })
    }

    return NextResponse.json({ item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const existing = await db.reservation.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    await db.reservation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
