import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/print-jobs/test-create
// Test print job yaratish - ofitsiant buyurtmasini simulyatsiya qiladi
export async function POST() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Barcha printer stansiyalarini olish
    const stations = await db.printerStation.findMany({
      where: { restaurantId: restaurant.id }
    })

    if (stations.length === 0) {
      return NextResponse.json({ error: 'Printer stansiyalari yoq' }, { status: 400 })
    }

    // Stollarni olish
    const tables = await db.restaurantTable.findMany({
      where: { restaurantId: restaurant.id }
    })
    const tableName = tables[0]?.name || 'Test stol'

    // Productlarni olish
    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id }
    })
    const productName = products[0]?.name || 'Test taom'

    const created = []
    for (const station of stations) {
      const content = JSON.stringify({
        orderNo: 'TEST-' + Date.now(),
        table: tableName,
        waiter: 'Test ofitsiant',
        createdAt: new Date().toISOString(),
        items: [{ productName: productName, quantity: 2, notes: 'Achchiqroq qiling' }],
        printerStationName: station.name,
        restaurantName: restaurant.name,
      })

      // orderId NULL - foreign key muammosi yo'q
      const job = await db.printJob.create({
        data: {
          restaurantId: restaurant.id,
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
