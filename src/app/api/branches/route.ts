import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/branches - restoran filiallari ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.branch.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'asc' },
    })

    // Har bir filial uchun statistika
    const branchesWithStats = await Promise.all(
      items.map(async (b: any) => {
        const [productsCount, staffCount, tablesCount] = await Promise.all([
          db.product.count({ where: { restaurantId: restaurant.id } }),
          db.staff.count({ where: { restaurantId: restaurant.id } }),
          db.restaurantTable.count({ where: { restaurantId: restaurant.id } }),
        ])
        return {
          ...b,
          stats: { products: productsCount, staff: staffCount, tables: tablesCount }
        }
      })
    )

    return NextResponse.json({ items: branchesWithStats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/branches - yangi filial qo'shish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { name, address, phone } = body

    if (!name) {
      return NextResponse.json({ error: 'Filial nomi majburiy' }, { status: 400 })
    }

    const branch = await db.branch.create({
      data: {
        restaurantId: restaurant.id,
        name,
        address: address || null,
        phone: phone || null,
      }
    })

    return NextResponse.json({ item: branch, message: 'Filial qo\'shildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
