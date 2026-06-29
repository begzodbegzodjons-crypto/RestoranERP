import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/shifts - smenalar ro'yxati
export async function GET() {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const shifts = await db.shift.findMany({
      where: { restaurantId: staff.restaurantId },
      include: { staff: true },
      orderBy: { openedAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ items: shifts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/shifts - yangi smena ochish (kassir)
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    if (staff.position !== 'cashier' && staff.position !== 'manager') {
      return NextResponse.json({ error: 'Faqat kassir smena ocha oladi' }, { status: 403 })
    }

    const body = await req.json()
    const openingCash = parseFloat(body.openingCash) || 0

    // Check if there's already an open shift
    const existing = await db.shift.findFirst({
      where: { restaurantId: staff.restaurantId, status: 'open' }
    })
    if (existing) {
      return NextResponse.json({ error: 'Allaqachon ochiq smena mavjud. Avval yoping.' }, { status: 400 })
    }

    const shift = await db.shift.create({
      data: {
        restaurantId: staff.restaurantId,
        staffId: staff.id,
        status: 'open',
        openingCash
      },
      include: { staff: true }
    })

    return NextResponse.json({ item: shift })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
