import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// POST /api/print-jobs/[id]/printed - print job ni "chop etilgan" deb belgilash
export async function POST({ params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const job = await db.printJob.findFirst({
      where: { id, restaurantId: staff.restaurantId }
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
