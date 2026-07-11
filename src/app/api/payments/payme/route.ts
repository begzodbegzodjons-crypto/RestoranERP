import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import crypto from 'crypto'

// Payme to'lov tizimi
// Hujjat: https://developer.help.paycom.uz/

const PAYME_MERCHANT_ID = process.env.PAYME_MERCHANT_ID || ''
const PAYME_KEY = process.env.PAYME_KEY || ''

// GET /api/payments/payme - Payme to'lov tizimi haqida ma'lumot
export async function GET() {
  return NextResponse.json({
    configured: !!(PAYME_MERCHANT_ID && PAYME_KEY),
    merchantId: PAYME_MERCHANT_ID || 'not set',
    instructions: 'Payme to\'lov tizimini sozlash uchun .env faylida quyidagi o\'zgaruvchilarni o\'rnating: PAYME_MERCHANT_ID, PAYME_KEY'
  })
}

// POST /api/payments/payme - Payme checkout yaratish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    if (!PAYME_MERCHANT_ID || !PAYME_KEY) {
      return NextResponse.json({ error: 'Payme to\'lov tizimi sozlanmagan' }, { status: 503 })
    }

    const body = await req.json()
    const { amount, description, returnUrl } = body

    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Minimal to\'lov 100 so\'m (Payme 1 tiyin = 100 so\'m)' }, { status: 400 })
    }

    // Payme uchun order ID
    const orderId = `order_${restaurant.id}_${Date.now()}`
    // Payme amount = so'm * 100 (tiyin)
    const amountInTiyin = Math.round(amount * 100)

    // Payme checkout URL yaratish
    // Format: https://checkout.paycom.uz/<base64-encoded-params>
    const params = `m=${PAYME_MERCHANT_ID};ac.order=${orderId};a=${amountInTiyin}`
    const encoded = Buffer.from(params).toString('base64')
    const paymeUrl = `https://checkout.paycom.uz/${encoded}`

    return NextResponse.json({
      paymentUrl: paymeUrl,
      orderId,
      amount,
      amountInTiyin,
      message: 'Payme to\'lov havolasi yaratildi'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
