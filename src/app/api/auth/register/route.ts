import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/register - Ro'yxatdan o'tish (10 kun trial bilan)
export async function POST(req: NextRequest) {
  try {
    // Dynamic imports - bu xatolarni aniq ushlaydi
    const { db } = await import('@/lib/db')
    const { hashPassword, createSession, getTrialEnd, getAccessStatus } = await import('@/lib/auth')
    const { notifyNewRegistration } = await import('@/lib/telegram')

    const body = await req.json()
    const { name, email, password, phone, address } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Barcha majburiy maydonlarni to\'ldiring' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Parol kamida 6 ta belgi bo\'lishi kerak' }, { status: 400 })
    }

    const existing = await db.restaurant.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' }, { status: 400 })
    }

    const restaurant = await db.restaurant.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        phone: phone || null,
        address: address || null,
        status: 'trial',
        trialStart: new Date(),
        trialEnd: getTrialEnd(),
      }
    })

    const token = await createSession(restaurant.id)

    // Admin'ga Telegram xabar (best-effort, not blocking)
    notifyNewRegistration({
      id: restaurant.id,
      name: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
    }).catch(() => {})

    const response = NextResponse.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
      },
      access: getAccessStatus(restaurant)
    })

    response.cookies.set('erp_session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return response
  } catch (e: any) {
    console.error('Register error:', e)
    return NextResponse.json({
      error: 'Server xatosi: ' + e.message,
    }, { status: 500 })
  }
}
