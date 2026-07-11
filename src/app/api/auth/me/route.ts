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
    // Telegram xabar yuborish (best-effort, bir martalik)
    if (access.state === 'blocked' && !access.blockedByAdmin) {
      // Telegram boti sozlangan bo'lsa, xabar yuborish
      if (restaurant.telegramBotToken && restaurant.telegramChatId) {
        // Faqat bir marta yuborish - notification log yoki flag sifatida
        // adminNotes'ga belgi qo'yamiz (oddiy yondashuv)
        const lastNotified = restaurant.adminNotes || ''
        const todayKey = `notified:${new Date().toISOString().slice(0, 10)}`

        if (!lastNotified.includes(todayKey)) {
          // Trial yoki aktivatsiya muddati tugaganini aniqlash
          const wasActivated = restaurant.activatedAt && restaurant.activationEnd
          if (wasActivated && restaurant.activationEnd! < new Date()) {
            notifyActivationExpired(restaurant).catch(() => {})
          } else if (restaurant.trialEnd < new Date()) {
            notifyTrialExpired(restaurant).catch(() => {})
          }

          // Belgi qo'yish (bir kun ichida qayta yubormaslik uchun)
          const newNotes = `${todayKey};${lastNotified}`.slice(0, 500)
          db.restaurant.update({
            where: { id: restaurant.id },
            data: { adminNotes: newNotes }
          }).catch(() => {})
        }
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
