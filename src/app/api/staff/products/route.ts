import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/staff/products - mahsulotlar (POS uchun)
export async function GET() {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const products = await db.product.findMany({
      where: {
        restaurantId: staff.restaurantId,
        isAvailable: true
      },
      include: { category: true },
      orderBy: { name: 'asc' }
    })

    const categories = await db.category.findMany({
      where: { restaurantId: staff.restaurantId },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ items: products, categories })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
