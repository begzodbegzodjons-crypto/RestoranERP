import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/reservations - rezervatsiyalar ro'yxati
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')

    const items = await db.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(date ? { reservationDate: new Date(date) } : {}),
        ...(status ? { status } : {})
      },
      include: { table: true },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
      take: 200
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/reservations - yangi rezervatsiya
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.customerName || !body.phone || !body.reservationDate || !body.reservationTime) {
      return NextResponse.json({ error: 'Ism, telefon, sana va vaqt majburiy' }, { status: 400 })
    }

    const item = await db.reservation.create({
      data: {
        restaurantId: restaurant.id,
        tableId: body.tableId || null,
        customerName: body.customerName,
        phone: body.phone,
        partySize: parseInt(body.partySize) || 2,
        reservationDate: new Date(body.reservationDate),
        reservationTime: body.reservationTime,
        status: body.status || 'pending',
        notes: body.notes || null
      },
      include: { table: true }
    })

    // Notification
    await db.notification.create({
      data: {
        restaurantId: restaurant.id,
        type: 'reservation',
        title: `Yangi rezervatsiya: ${body.customerName}`,
        message: `${body.reservationDate} ${body.reservationTime}, ${body.partySize} kishi, tel: ${body.phone}`,
        audience: 'admin'
      }
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
