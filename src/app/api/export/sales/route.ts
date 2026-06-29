import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/export/sales - savdo tarixini CSV eksport
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const sales = await db.sale.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        items: { include: { product: true } },
        table: true,
        customer: true,
        staff: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5000
    })

    const headers = [
      'Chek #', 'Sana', 'Stol', 'Ofitsiant', 'Mijoz',
      'Oraliq', 'Chegirma', 'Soliq', 'Jami', 'Tannarx', 'Foyda',
      'To\'lov turi', 'Holat', 'Pozitsiyalar'
    ]

    const rows = sales.map(s => [
      s.invoiceNo,
      new Date(s.createdAt).toLocaleString('uz-UZ'),
      s.table?.name || '',
      s.staff?.name || '',
      s.customer?.name || '',
      s.subtotal,
      s.discount,
      s.taxAmount,
      s.total,
      s.costOfGoods,
      s.profit,
      s.paymentMethod,
      s.status,
      s.items.map(it => `${it.product.name} x${it.quantity}`).join('; ')
    ])

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // BOM for Excel UTF-8
    const csvWithBom = '\uFEFF' + csv

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="savdo-${new Date().toISOString().slice(0,10)}.csv"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
