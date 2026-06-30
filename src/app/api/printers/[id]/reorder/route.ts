import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/printers/[id]/reorder - printer tartibini o'zgartirish
// Body: { direction: 'up' | 'down' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const direction = body.direction // 'up' | 'down'

    if (!['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'Direction majburiy (up/down)' }, { status: 400 })
    }

    // Get all printers sorted by sortOrder
    const allPrinters = await db.printerStation.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    })

    const currentIndex = allPrinters.findIndex(p => p.id === id)
    if (currentIndex === -1) return NextResponse.json({ error: 'Printer topilmadi' }, { status: 404 })

    let swapIndex: number
    if (direction === 'up') {
      if (currentIndex === 0) return NextResponse.json({ error: 'Allaqachon eng yuqorida' }, { status: 400 })
      swapIndex = currentIndex - 1
    } else {
      if (currentIndex === allPrinters.length - 1) return NextResponse.json({ error: 'Allaqachon eng pastda' }, { status: 400 })
      swapIndex = currentIndex + 1
    }

    const current = allPrinters[currentIndex]
    const swap = allPrinters[swapIndex]

    // Swap sortOrder values
    await db.printerStation.update({ where: { id: current.id }, data: { sortOrder: swap.sortOrder } })
    await db.printerStation.update({ where: { id: swap.id }, data: { sortOrder: current.sortOrder } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
