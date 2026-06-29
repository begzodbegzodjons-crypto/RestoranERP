import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/print-jobs/auto - avtomatik print uchun kutilayotgan print joblar
// AutoPrintMonitor komponenti har 2 soniyada chaqiradi
// Faqat autoPrintReady=true va status=pending bo'lgan joblarni qaytaradi
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const jobs = await db.printJob.findMany({
      where: {
        restaurantId: restaurant.id,
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
      content: JSON.parse(j.content),
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
