import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/print-jobs/[id]/mark-printed
// Print job ni "chop etilgan" deb belgilash (restaurant auth bilan)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const job = await db.printJob.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!job) return NextResponse.json({ error: 'Print job topilmadi' }, { status: 404 })

    const updated = await db.printJob.update({
      where: { id },
      data: {
        status: 'printed',
        printedAt: new Date()
      }
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/print-jobs/[id]/mark-failed
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const job = await db.printJob.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!job) return NextResponse.json({ error: 'Print job topilmadi' }, { status: 404 })

    const updated = await db.printJob.update({
      where: { id },
      data: { status: 'failed' }
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
