import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import crypto from 'crypto'

// (end of file - remove duplicate import at bottom)

// Click to'lov tizimi uchun sozlash
// Hujjat: https://docs.click.uz/

const CLICK_MERCHANT_ID = process.env.CLICK_MERCHANT_ID || ''
const CLICK_SERVICE_ID = process.env.CLICK_SERVICE_ID || ''
const CLICK_SECRET_KEY = process.env.CLICK_SECRET_KEY || ''
const CLICK_MERCHANT_USER_ID = process.env.CLICK_MERCHANT_USER_ID || ''

// GET /api/payments/click - Click to'lov tizimi haqida ma'lumot
export async function GET() {
  return NextResponse.json({
    configured: !!(CLICK_MERCHANT_ID && CLICK_SERVICE_ID && CLICK_SECRET_KEY),
    merchantId: CLICK_MERCHANT_ID || 'not set',
    serviceId: CLICK_SERVICE_ID || 'not set',
    instructions: 'Click to\'lov tizimini sozlash uchun .env faylida quyidagi o\'zgaruvchilarni o\'rnating: CLICK_MERCHANT_ID, CLICK_SERVICE_ID, CLICK_SECRET_KEY, CLICK_MERCHANT_USER_ID'
  })
}

// POST /api/payments/click - Click to'lov yaratish (restoran to'lovi uchun)
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    if (!CLICK_MERCHANT_ID || !CLICK_SERVICE_ID || !CLICK_SECRET_KEY) {
      return NextResponse.json({ error: 'Click to\'lov tizimi sozlanmagan' }, { status: 503 })
    }

    const body = await req.json()
    const { amount, description, returnUrl } = body

    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Minimal to\'lov 100 so\'m' }, { status: 400 })
    }

    // Click uchun buyurtma ID generatsiya qilish
    const orderId = `order_${restaurant.id}_${Date.now()}`
    // Auth sign yaratish
    const signString = `${CLICK_MERCHANT_ID}${CLICK_SERVICE_ID}${orderId}${amount}${CLICK_SECRET_KEY}`
    const sign = crypto.createHash('md5').update(signString).digest('hex')

    // Click redirect URL
    const clickUrl = `https://my.click.uz/services/pay?service_id=${CLICK_SERVICE_ID}&merchant_id=${CLICK_MERCHANT_ID}&amount=${amount}&transaction_param=${orderId}&return_url=${returnUrl || ''}`

    return NextResponse.json({
      paymentUrl: clickUrl,
      orderId,
      amount,
      sign,
      message: 'Click to\'lov havolasi yaratildi'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Click webhook (server-to-server callback)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { click_trans_id, service_id, click_paydoc_id, merchant_trans_id, amount, action, error, sign_time, sign_string } = body

    // Sign stringni tekshirish
    const expectedSign = crypto.createHash('md5')
      .update(`${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`)
      .digest('hex')

    if (sign_string !== expectedSign) {
      return NextResponse.json({ error: -1, error_note: 'Invalid sign' })
    }

    if (action === 0) {
      // Pre-confirm - tekshirish
      return NextResponse.json({
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: click_paydoc_id,
        error: 0,
        error_note: 'Success'
      })
    } else if (action === 1) {
      // Complete - to'lov yakunlandi
      // Bu yerda to'lovni saqlash va restoranni aktivlashtirish kerak
      // restaurantId'ni merchant_trans_id'dan olish
      const restaurantId = merchant_trans_id.replace('order_', '').split('_')[0]
      const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } })
      if (restaurant) {
        // Aktivlashtirish kodi yaratish kabi logika
        // ...
      }

      return NextResponse.json({
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: click_paydoc_id,
        error: 0,
        error_note: 'Success'
      })
    }

    return NextResponse.json({ error: -1, error_note: 'Unknown action' })
  } catch (e: any) {
    return NextResponse.json({ error: -1, error_note: e.message })
  }
}
