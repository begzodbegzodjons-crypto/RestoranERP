import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/print-jobs/auto - avtomatik print uchun kutilayotgan print joblar
// Restoran egasi Yoki ofitsiant/kassir bilan ishlaydi
// AutoPrintMonitor komponenti har 3 soniyada chaqiradi
export async function GET() {
  try {
    // Avval restoran egasi sifatida tekshirish
    let restaurantId: string | null = null

    const restaurant = await getCurrentRestaurant()
    if (restaurant) {
      restaurantId = restaurant.id
    } else {
      // Ofitsiant/kassir sifatida tekshirish
      const staff = await getCurrentStaff()
      if (staff) {
        restaurantId = staff.restaurantId
      }
    }

    if (!restaurantId) {
      return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })
    }

    const jobs = await db.printJob.findMany({
      where: {
        restaurantId,
        status: 'pending',
        autoPrintReady: true
      },
      include: {
        printerStation: true,
        order: {
          include: { table: true, waiter: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    })

    const formatted = jobs.map(j => ({
      id: j.id,
      content: j.content ? (typeof j.content === 'string' ? JSON.parse(j.content) : j.content) : {},
      printerStation: {
        id: j.printerStation.id,
        name: j.printerStation.name
      },
      createdAt: j.createdAt
    }))

    return NextResponse.json({ jobs: formatted, count: formatted.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
