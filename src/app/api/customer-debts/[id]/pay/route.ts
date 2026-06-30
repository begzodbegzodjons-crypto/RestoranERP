import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/customer-debts/[id]/pay - qarzni qisman/to'liq to'lash
// Body: { amount: number }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const paymentAmount = parseFloat(body.amount)

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json({ error: 'To\'g\'ri summa kiriting' }, { status: 400 })
    }

    const debt = await db.customerDebt.findFirst({
      where: { id, restaurantId: restaurant.id }
    })
    if (!debt) return NextResponse.json({ error: 'Qarz topilmadi' }, { status: 404 })

    if (debt.status === 'paid') {
      return NextResponse.json({ error: 'Qarz allaqachon to\'langan' }, { status: 400 })
    }

    const newPaidAmount = debt.paidAmount + paymentAmount
    const newRemaining = Math.max(0, debt.amount - newPaidAmount)
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial'

    // Don't allow overpayment
    if (newPaidAmount > debt.amount) {
      return NextResponse.json({ error: `To'lash summasi qarzdan ko'p. Qolgan: ${debt.remaining.toLocaleString()} UZS` }, { status: 400 })
    }

    const updated = await db.customerDebt.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        remaining: newRemaining,
        status: newStatus
      },
      include: { customer: true }
    })

    return NextResponse.json({
      item: updated,
      message: newStatus === 'paid' ? 'Qarz to\'liq to\'landi!' : `${paymentAmount.toLocaleString()} UZS to\'landi. Qolgan: ${newRemaining.toLocaleString()} UZS`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
