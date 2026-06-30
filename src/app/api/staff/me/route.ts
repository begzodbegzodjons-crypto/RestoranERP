import { NextResponse } from 'next/server'
import { getCurrentStaff, deleteStaffSession } from '@/lib/staff-auth'
import { cookies } from 'next/headers'

// GET /api/staff/me - current staff info
export async function GET() {
  try {
    const staff = await getCurrentStaff()
    if (!staff) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      staff: {
        id: staff.id,
        name: staff.name,
        position: staff.position,
        phone: staff.phone,
      },
      restaurant: {
        id: staff.restaurant.id,
        name: staff.restaurant.name,
        currency: staff.restaurant.currency,
        serviceChargePercent: staff.restaurant.serviceChargePercent,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, error: e.message }, { status: 500 })
  }
}

// POST /api/staff/me - logout
export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_staff')?.value
    if (token) await deleteStaffSession(token)
    const response = NextResponse.json({ success: true })
    response.cookies.delete('erp_staff')
    return response
  } catch {
    return NextResponse.json({ success: true })
  }
}
