import { NextResponse } from 'next/server'
import { getCurrentRestaurant, deleteSession, getAccessStatus } from '@/lib/auth'
import { notifyTrialExpired, notifyActivationExpired } from '@/lib/telegram'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

// GET /api/auth/me - joriy restoran ma'lumotlari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const access = getAccessStatus(restaurant)

    // Agar bloklangan bo'lsa va admin tomonidan emas (muddat tugagan bo'lsa) -
    // Admin'ga Telegram xabar yuborish (best-effort, kuniga bir marta)
    if (access.state === 'blocked' && !access.blockedByAdmin) {
      // adminNotes'da bugungi belgi bor-yo'qligini tekshirish
      const lastNotified = restaurant.adminNotes || ''
      const todayKey = `notified:${new Date().toISOString().slice(0, 10)}`

      if (!lastNotified.includes(todayKey)) {
        // Trial yoki aktivatsiya muddati tugaganini aniqlash
        const wasActivated = restaurant.activatedAt && restaurant.activationEnd
        if (wasActivated && restaurant.activationEnd! < new Date()) {
          // Aktivatsiya muddati tugagan - admin'ga xabar
          notifyActivationExpired({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email,
            phone: restaurant.phone,
            activationEnd: restaurant.activationEnd,
          }).catch(() => {})
        } else if (restaurant.trialEnd < new Date()) {
          // Trial muddati tugagan - admin'ga xabar
          notifyTrialExpired({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email,
            phone: restaurant.phone,
            trialEnd: restaurant.trialEnd,
          }).catch(() => {})
        }

        // Belgi qo'yish (bir kun ichida qayta yubormaslik uchun)
        const newNotes = `${todayKey};${lastNotified}`.slice(0, 500)
        db.restaurant.update({
          where: { id: restaurant.id },
          data: { adminNotes: newNotes }
        }).catch(() => {})
      }
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
      access
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
