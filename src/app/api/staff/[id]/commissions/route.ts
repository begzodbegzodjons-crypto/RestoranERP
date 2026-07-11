import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/staff/[id]/commissions - xodim komissiyalari
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const paid = searchParams.get('paid')

    const items = await db.staffCommission.findMany({
      where: {
        restaurantId: restaurant.id,
        staffId: id,
        ...(paid !== null ? { paid: paid === 'true' } : {})
      },
      orderBy: { createdAt: 'desc' },
    })

    // Umumiy balans
    const total = items.reduce((acc: any, c: any) => {
      acc.total += c.amount
      if (c.paid) acc.paid += c.amount
      else acc.unpaid += c.amount
      return acc
    }, { total: 0, paid: 0, unpaid: 0 })

    return NextResponse.json({ items, summary: total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/staff/[id]/commissions - yangi komissiya/choy puli qo'shish
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { type, amount, isPercent, percent, saleId, description } = body

    if (!type || (amount === undefined && percent === undefined)) {
      return NextResponse.json({ error: 'type va amount/percent majburiy' }, { status: 400 })
    }

    // Haqiqiy amount hisoblash
    let finalAmount = amount || 0
    if (isPercent && percent && saleId) {
      const sale = await db.sale.findUnique({ where: { id: saleId } })
      if (sale) {
        finalAmount = (sale.total * percent) / 100
      }
    }

    const commission = await db.staffCommission.create({
      data: {
        restaurantId: restaurant.id,
        staffId: id,
        saleId: saleId || null,
        type: type || 'commission',
        amount: finalAmount,
        isPercent: !!isPercent,
        percent: percent || 0,
        description: description || null,
      }
    })

    // Agar saleId bo'lsa, sale'ga ham qo'shish
    if (saleId && type === 'commission') {
      await db.sale.update({
        where: { id: saleId },
        data: { commissionAmount: { increment: finalAmount } }
      })
    } else if (saleId && type === 'tip') {
      await db.sale.update({
        where: { id: saleId },
        data: { tipAmount: { increment: finalAmount } }
      })
    }

    return NextResponse.json({ item: commission, message: 'Komissiya qo\'shildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
