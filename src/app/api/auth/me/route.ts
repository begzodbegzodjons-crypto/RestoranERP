import { NextResponse } from 'next/server'
import { getCurrentRestaurant, deleteSession, getAccessStatus } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET /api/auth/me - joriy restoran ma'lumotlari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        address: restaurant.address,
        currency: restaurant.currency,
      },
      access: getAccessStatus(restaurant)
    })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, error: e.message }, { status: 500 })
  }
}

// POST /api/auth/logout - tizimdan chiqish
export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_session')?.value
    if (token) {
      await deleteSession(token)
    }
    const response = NextResponse.json({ success: true })
    response.cookies.delete('erp_session')
    return response
  } catch {
    return NextResponse.json({ success: true })
  }
}
