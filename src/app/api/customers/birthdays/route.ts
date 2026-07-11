import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/customers/birthdays - yaqinlashayotgan tug'ilgan kunlar
// Query: days=7 (kelgusi 7 kun)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')

    const customers = await db.customer.findMany({
      where: {
        restaurantId: restaurant.id,
        birthday: { not: null }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        birthday: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        totalSpent: true,
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming: any[] = []
    const today_: any[] = []

    for (const c of customers) {
      if (!c.birthday) continue

      // Bu yilgi tug'ilgan kun
      const birthdayThisYear = new Date(today.getFullYear(), c.birthday.getMonth(), c.birthday.getDate())
      birthdayThisYear.setHours(0, 0, 0, 0)

      // Agar o'tib ketgan bo'lsa, keyingi yilga o'tkazamiz
      let nextBirthday = birthdayThisYear
      if (nextBirthday < today) {
        nextBirthday = new Date(today.getFullYear() + 1, c.birthday.getMonth(), c.birthday.getDate())
      }

      const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Bugun tug'ilgan kun
      if (daysUntil === 0) {
        today_.push({
          ...c,
          age: today.getFullYear() - c.birthday.getFullYear(),
          daysUntil: 0,
        })
      } else if (daysUntil <= days) {
        upcoming.push({
          ...c,
          age: nextBirthday.getFullYear() - c.birthday.getFullYear(),
          daysUntil,
          nextBirthday: nextBirthday.toISOString(),
        })
      }
    }

    // Avtomatik bildirishnoma yaratish (faqat bugungi uchun)
    const todayKey = today.toISOString().slice(0, 10)
    for (const c of today_) {
      // Bugun bildirishnoma yaratilganmi tekshirish
      const existing = await db.notification.findFirst({
        where: {
          restaurantId: restaurant.id,
          type: 'birthday',
          metadata: { contains: c.id },
          createdAt: { gte: new Date(todayKey) }
        }
      })

      if (!existing) {
        await db.notification.create({
          data: {
            restaurantId: restaurant.id,
            type: 'birthday',
            title: '🎂 Tug\'ilgan kun tabrigi',
            message: `Bugun ${c.name} mijozning tug'ilgan kuni! Yosh: ${c.age}. Telefon: ${c.phone || '—'}`,
            audience: 'all',
            metadata: JSON.stringify({ customerId: c.id, type: 'birthday_today' }),
          }
        })
      }
    }

    return NextResponse.json({
      today: today_,
      upcoming: upcoming.sort((a, b) => a.daysUntil - b.daysUntil),
      summary: {
        todayCount: today_.length,
        upcomingCount: upcoming.length,
        totalWithBirthday: customers.length,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
