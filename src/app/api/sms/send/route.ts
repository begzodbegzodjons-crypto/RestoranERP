import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// SMS gateway - Eskiz.uz yoki PlayMobile
// Hujjat: https://eskiz.uz/api, https://playmobile.uz

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'eskiz' // eskiz | playmobile
const SMS_EMAIL = process.env.SMS_EMAIL || ''
const SMS_PASSWORD = process.env.SMS_PASSWORD || ''
const SMS_FROM = process.env.SMS_FROM || '4546' // Eskiz sender

let _eskizToken: string | null = null
let _eskizTokenExpiry: number = 0

// Eskiz.uz dan token olish
async function getEskizToken(): Promise<string | null> {
  if (_eskizToken && Date.now() < _eskizTokenExpiry) {
    return _eskizToken
  }

  if (!SMS_EMAIL || !SMS_PASSWORD) return null

  try {
    const res = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SMS_EMAIL, password: SMS_PASSWORD })
    })
    const data = await res.json()
    if (data.data?.token) {
      _eskizToken = data.data.token
      // Token 30 kun amal qiladi, biz 1 kun oldin yangilaymiz
      _eskizTokenExpiry = Date.now() + 24 * 60 * 60 * 1000
      return _eskizToken
    }
  } catch (e) {
    console.error('Eskiz token error:', e)
  }
  return null
}

// SMS yuborish (Eskiz)
async function sendEskizSMS(phone: string, message: string): Promise<boolean> {
  const token = await getEskizToken()
  if (!token) return false

  // Telefon raqamni formatlash (998901234567)
  const formattedPhone = phone.replace(/\D/g, '').replace(/^8/, '998').replace(/^\+/, '')

  try {
    const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        mobile_phone: formattedPhone,
        message: message,
        from: SMS_FROM,
      })
    })
    const data = await res.json()
    return res.ok
  } catch (e) {
    console.error('Eskiz SMS error:', e)
    return false
  }
}

// SMS yuborish (PlayMobile)
async function sendPlayMobileSMS(phone: string, message: string): Promise<boolean> {
  const PLAYMOBILE_USERNAME = process.env.PLAYMOBILE_USERNAME || ''
  const PLAYMOBILE_PASSWORD = process.env.PLAYMOBILE_PASSWORD || ''
  const PLAYMOBILE_ORIGINATOR = process.env.PLAYMOBILE_ORIGINATOR || '3700'

  if (!PLAYMOBILE_USERNAME || !PLAYMOBILE_PASSWORD) return false

  const formattedPhone = phone.replace(/\D/g, '').replace(/^8/, '998').replace(/^\+/, '')

  try {
    const res = await fetch(`https://api.playmobile.uz/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${PLAYMOBILE_USERNAME}:${PLAYMOBILE_PASSWORD}`).toString('base64')
      },
      body: JSON.stringify({
        messages: [{
          recipient: formattedPhone,
          'message-id': `msg_${Date.now()}`,
          originator: PLAYMOBILE_ORIGINATOR,
          message: {
            'content-type': 'text/plain',
            text: message
          }
        }]
      })
    })
    return res.ok
  } catch (e) {
    console.error('PlayMobile SMS error:', e)
    return false
  }
}

// SMS yuborish (umumiy wrapper)
export async function sendSMS(phone: string, message: string): Promise<boolean> {
  if (SMS_PROVIDER === 'playmobile') {
    return sendPlayMobileSMS(phone, message)
  }
  return sendEskizSMS(phone, message)
}

// GET /api/sms/send - SMS gateway holati
export async function GET() {
  return NextResponse.json({
    configured: SMS_PROVIDER === 'eskiz' ? !!(SMS_EMAIL && SMS_PASSWORD) : !!process.env.PLAYMOBILE_USERNAME,
    provider: SMS_PROVIDER,
    instructions: 'SMS sozlash uchun .env: SMS_PROVIDER=eskiz, SMS_EMAIL, SMS_PASSWORD, SMS_FROM=4546 yoki SMS_PROVIDER=playmobile, PLAYMOBILE_USERNAME, PLAYMOBILE_PASSWORD, PLAYMOBILE_ORIGINATOR'
  })
}

// POST /api/sms/send - SMS yuborish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone va message majburiy' }, { status: 400 })
    }

    if (message.length > 700) {
      return NextResponse.json({ error: 'SMS 700 belgidan oshmasligi kerak' }, { status: 400 })
    }

    const result = await sendSMS(phone, message)
    if (!result) {
      return NextResponse.json({ error: 'SMS yuborilmadi. Provider sozlamasini tekshiring.' }, { status: 500 })
    }

    // Admin log
    await db.adminLog.create({
      data: {
        action: 'sms_sent',
        detail: `SMS to ${phone}: ${message.substring(0, 50)}...`
      }
    })

    return NextResponse.json({ success: true, message: 'SMS yuborildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
