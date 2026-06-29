import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/export/products - mahsulotlar CSV eksport
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id },
      include: { category: true }
    })

    const headers = ['Nomi', 'Kategoriya', 'Sotuv narxi', 'Tannarx', 'Foyda', 'Marja %', 'Birlik', 'Mavjud']

    const rows = products.map(p => {
      const profit = p.price - p.cost
      const margin = p.price > 0 ? (profit / p.price * 100).toFixed(1) : '0'
      return [
        p.name,
        p.category?.name || '',
        p.price,
        p.cost,
        profit,
        margin,
        p.unit,
        p.isAvailable ? 'Ha' : 'Yo\'q'
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mahsulotlar-${new Date().toISOString().slice(0,10)}.csv"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
