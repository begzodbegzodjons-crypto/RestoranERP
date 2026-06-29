import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createStaffSession, hashPin, verifyPin } from '@/lib/staff-auth'

// POST /api/staff/login
// Body: { restaurantId, pin } or { restaurantId, email, password }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurantId, pin, email, password } = body

    if (!restaurantId) {
      return NextResponse.json({ error: 'Restoran ID kerak' }, { status: 400 })
    }

    // Find staff by restaurant + identifier
    let staff
    if (pin) {
      // PIN-based login (kassir/ofitsiant uchun tezkor)
      if (!/^\d{4,6}$/.test(pin)) {
        return NextResponse.json({ error: 'PIN 4-6 raqamli bo\'lishi kerak' }, { status: 400 })
      }
      // Find all staff in restaurant, then verify PIN
      const allStaff = await db.staff.findMany({
        where: {
          restaurantId,
          status: 'active',
          pin: { not: null }
        }
      })
      staff = allStaff.find(s => s.pin === pin)
      if (!staff) {
        return NextResponse.json({ error: 'Noto\'g\'ri PIN' }, { status: 401 })
      }
    } else if (email && password) {
      // Email + password login (manager uchun)
      staff = await db.staff.findFirst({
        where: {
          restaurantId,
          status: 'active',
          email: email.toLowerCase()
        }
      })
      // Note: email field doesn't exist on Staff model - using phone as fallback
      // For now only PIN login supported
      return NextResponse.json({ error: 'Faqat PIN bilan kirish qo\'llab-quvvatlanadi' }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'PIN kerak' }, { status: 400 })
    }

    // Verify staff still has access
    if (staff.status !== 'active') {
      return NextResponse.json({ error: 'Xodim faol emas' }, { status: 403 })
    }

    // Check restaurant access status
    const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }
    if (restaurant.blockedByAdmin) {
      return NextResponse.json({ error: 'Restoran bloklangan' }, { status: 403 })
    }

    const token = await createStaffSession(staff.id)

    const response = NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        position: staff.position,
      }
    })

    response.cookies.set('erp_staff', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/'
    })

    return response
  } catch (e: any) {
    console.error('Staff login error:', e)
    return NextResponse.json({ error: 'Server xatosi: ' + e.message }, { status: 500 })
  }
}
