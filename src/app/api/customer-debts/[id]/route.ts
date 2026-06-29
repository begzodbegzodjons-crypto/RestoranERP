import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await db.customerDebt.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const updated = await db.customerDebt.update({
      where: { id },
      data: {
        customerName: body.customerName,
        phone: body.phone,
        amount: parseFloat(body.amount) || existing.amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : (body.dueDate === null ? null : undefined),
        notes: body.notes
      },
      include: { customer: true }
    })

    // Recalculate remaining
    const remaining = updated.amount - updated.paidAmount
    const status = remaining <= 0 ? 'paid' : (updated.paidAmount > 0 ? 'partial' : 'unpaid')
    await db.customerDebt.update({ where: { id }, data: { remaining, status } })

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
    const existing = await db.customerDebt.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    await db.customerDebt.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
