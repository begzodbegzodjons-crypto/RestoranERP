import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// POST /api/coupons/[id]/validate
// Body: { orderTotal: number }
// Returns: { valid, discount, message }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const orderTotal = parseFloat(body.orderTotal) || 0

    // id could be the coupon code (we accept both id and code)
    const coupon = await db.coupon.findFirst({
      where: {
        restaurantId: restaurant.id,
        OR: [
          { id },
          { code: id.toString().toUpperCase().trim() }
        ]
      }
    })

    if (!coupon) {
      return NextResponse.json({ valid: false, message: 'Kupon topilmadi' })
    }

    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, message: 'Kupon faol emas' })
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      return NextResponse.json({ valid: false, message: 'Kupon muddati tugagan' })
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, message: 'Kupon ishlatish chegarasiga yetgan' })
    }

    if (orderTotal < coupon.minOrder) {
      return NextResponse.json({
        valid: false,
        message: `Min buyurtma: ${coupon.minOrder.toLocaleString()} UZS`
      })
    }

    // Calculate discount
    let discount = 0
    if (coupon.discountType === 'percent') {
      discount = orderTotal * (coupon.discountValue / 100)
    } else {
      discount = coupon.discountValue
      if (discount > orderTotal) discount = orderTotal
    }

    return NextResponse.json({
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount,
      message: `Chegirma: ${discount.toLocaleString()} UZS`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
