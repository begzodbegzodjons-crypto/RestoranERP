import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, getAccessStatus } from '@/lib/auth'

// POST /api/auth/login - Tizimga kirish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email va parol kiriting' }, { status: 400 })
    }

    const restaurant = await db.restaurant.findUnique({
      where: { email: email.toLowerCase() }
    })
    if (!restaurant) {
      return NextResponse.json({ error: 'Email yoki parol noto\'g\'ri' }, { status: 401 })
    }

    if (!verifyPassword(password, restaurant.passwordHash)) {
      return NextResponse.json({ error: 'Email yoki parol noto\'g\'ri' }, { status: 401 })
    }

    const token = await createSession(restaurant.id)

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
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
