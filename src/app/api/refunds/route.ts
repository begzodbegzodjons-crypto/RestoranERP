import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/refunds - restoran bo'yicha barcha qaytarishlar
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const saleId = searchParams.get('saleId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const items = await db.refund.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(saleId ? { saleId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/refunds - yangi qaytarish (refund)
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { saleId, amount, reason, items, restockItems } = body

    if (!saleId || !amount || !reason) {
      return NextResponse.json({ error: 'saleId, amount va reason majburiy' }, { status: 400 })
    }

    // Savdoni topish
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    })
    if (!sale || sale.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Savdo topilmadi' }, { status: 404 })
    }

    // Qaytarish yozuvi yaratish
    const refund = await db.refund.create({
      data: {
        restaurantId: restaurant.id,
        saleId,
        amount,
        reason,
        items: items ? JSON.stringify(items) : null,
        restocked: !!restockItems,
      }
    })

    // Savdo statusini yangilash
    const newRefundedAmount = sale.refundedAmount + amount
    const newStatus = newRefundedAmount >= sale.total ? 'refunded' : 'partial_refund'

    await db.sale.update({
      where: { id: saleId },
      data: {
        refundedAmount: newRefundedAmount,
        refundedAt: new Date(),
        status: newStatus,
      }
    })

    // Agar restockItems true bo'lsa, mahsulotlarni omborga qaytarish
    if (restockItems && items && Array.isArray(items)) {
      for (const item of items) {
        if (item.saleItemId && item.qty) {
          const saleItem = sale.items.find(si => si.id === item.saleItemId)
          if (saleItem) {
            // Product'ning retseptidagi ingredientlarni omborga qaytarish
            const recipes = await db.recipe.findMany({
              where: { productId: saleItem.productId }
            })
            for (const recipe of recipes) {
              const returnQty = recipe.quantity * item.qty
              await db.ingredient.update({
                where: { id: recipe.ingredientId },
                data: { stock: { increment: returnQty } }
              })
              // InventoryItem yozuvi
              await db.inventoryItem.create({
                data: {
                  restaurantId: restaurant.id,
                  ingredientId: recipe.ingredientId,
                  type: 'in',
                  quantity: returnQty,
                  unitPrice: 0,
                  reason: 'refund',
                  refType: 'Refund',
                  refId: refund.id,
                }
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ item: refund, message: 'Qaytarish muvaffaqiyatli amalga oshirildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
