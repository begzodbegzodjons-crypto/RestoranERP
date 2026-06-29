import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/staff/settings - service charge sozlamasi (restaurant admin uchun)
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    return NextResponse.json({
      serviceChargePercent: restaurant.serviceChargePercent,
      taxRate: restaurant.taxRate,
      currency: restaurant.currency
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/staff/settings - service charge yangilash
export async function PUT(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const serviceChargePercent = parseFloat(body.serviceChargePercent) || 0

    if (serviceChargePercent < 0 || serviceChargePercent > 100) {
      return NextResponse.json({ error: 'Foiz 0-100 orasida bo\'lishi kerak' }, { status: 400 })
    }

    const updated = await db.restaurant.update({
      where: { id: restaurant.id },
      data: { serviceChargePercent }
    })

    return NextResponse.json({
      success: true,
      serviceChargePercent: updated.serviceChargePercent
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
