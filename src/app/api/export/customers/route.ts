import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/export/customers - mijozlar CSV eksport
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const customers = await db.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' }
    })

    const headers = ['Ism', 'Telefon', 'Email', 'Manzil', 'Buyurtmalar soni', 'Jami sarflagan', 'Loyalty ballari', 'Ro\'yxatga olingan']

    const rows = customers.map(c => [
      c.name,
      c.phone || '',
      c.email || '',
      c.address || '',
      c.totalOrders,
      c.totalSpent,
      c.loyaltyPoints || 0,
      new Date(c.createdAt).toLocaleDateString('uz-UZ')
    ])

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mijozlar-${new Date().toISOString().slice(0,10)}.csv"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
