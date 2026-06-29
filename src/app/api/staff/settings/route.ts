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
      vatRate: restaurant.vatRate,
      currency: restaurant.currency,
      telegramBotToken: restaurant.telegramBotToken ? 'configured' : null
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/staff/settings - service charge / VAT / telegram yangilash
export async function PUT(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const updates: any = {}

    if (body.serviceChargePercent != null) {
      const v = parseFloat(body.serviceChargePercent)
      if (v < 0 || v > 100) return NextResponse.json({ error: 'Xizmat foizi 0-100 orasida' }, { status: 400 })
      updates.serviceChargePercent = v
    }
    if (body.vatRate != null) {
      const v = parseFloat(body.vatRate)
      if (v < 0 || v > 100) return NextResponse.json({ error: 'QQS 0-100 orasida' }, { status: 400 })
      updates.vatRate = v
    }
    if (body.telegramBotToken !== undefined) {
      updates.telegramBotToken = body.telegramBotToken || null
    }
    if (body.telegramChatId !== undefined) {
      updates.telegramChatId = body.telegramChatId || null
    }

    const updated = await db.restaurant.update({
      where: { id: restaurant.id },
      data: updates
    })

    return NextResponse.json({
      success: true,
      serviceChargePercent: updated.serviceChargePercent,
      vatRate: updated.vatRate,
      telegramConfigured: !!updated.telegramBotToken
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
