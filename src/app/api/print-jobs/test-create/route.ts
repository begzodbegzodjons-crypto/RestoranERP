import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/print-jobs/test-create
export async function POST() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const stations = await db.printerStation.findMany({
      where: { restaurantId: restaurant.id }
    })

    if (stations.length === 0) {
      return NextResponse.json({ error: 'Printer stansiyalari yoq' }, { status: 400 })
    }

    const created = []
    for (const station of stations) {
      const content = JSON.stringify({
        orderNo: 'TEST-' + Date.now(),
        table: 'Test stol',
        waiter: 'Test',
        createdAt: new Date().toISOString(),
        items: [{ productName: 'Test taom', quantity: 1, notes: 'Test izoh' }],
        printerStationName: station.name,
        restaurantName: restaurant.name,
      })

      const job = await db.printJob.create({
        data: {
          restaurantId: restaurant.id,
          orderId: 'test-' + Date.now(),
          printerStationId: station.id,
          status: 'pending',
          content,
          autoPrintReady: true,
        }
      })
      created.push({ id: job.id, station: station.name })
    }

    return NextResponse.json({ success: true, count: created.length, jobs: created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
