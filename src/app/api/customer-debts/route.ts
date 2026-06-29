import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/customer-debts
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const items = await db.customerDebt.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(status ? { status } : {})
      },
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/customer-debts - yangi qarz yozuvi
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    if (!body.customerName || !body.phone || !body.amount) {
      return NextResponse.json({ error: 'Ism, telefon va summa majburiy' }, { status: 400 })
    }

    const amount = parseFloat(body.amount)
    const item = await db.customerDebt.create({
      data: {
        restaurantId: restaurant.id,
        customerId: body.customerId || null,
        customerName: body.customerName,
        phone: body.phone,
        amount,
        paidAmount: 0,
        remaining: amount,
        status: 'unpaid',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null
      },
      include: { customer: true }
    })

    await db.notification.create({
      data: {
        restaurantId: restaurant.id,
        type: 'debt',
        title: `Yangi qarz: ${body.customerName}`,
        message: `${amount.toLocaleString()} UZS, tel: ${body.phone}`,
        audience: 'admin'
      }
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
