import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// POST /api/staff/orders/[id]/cancel - Buyurtmani bekor qilish (rad etish)
// Body: { reason: string, itemIds?: string[] } - agar itemIds bo'sa, faqat o'sha taomlar bekor qilinadi
// Agar itemIds yo'q bo'lsa, butun buyurtma bekor qilinadi
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Faqat kassir yoki menejer bekor qila oladi
    if (staff.position !== 'cashier' && staff.position !== 'manager') {
      return NextResponse.json({ error: 'Faqat kassir bekor qila oladi' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { reason, itemIds } = body

    if (!reason) {
      return NextResponse.json({ error: 'Bekor qilish sababi kerak' }, { status: 400 })
    }

    const order = await db.order.findFirst({
      where: { id, restaurantId: staff.restaurantId },
      include: { items: true, table: true }
    })
    if (!order) return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })

    if (order.status === 'paid') {
      return NextResponse.json({ error: 'To\'lov qilingan buyurtmani bekor qilib bo\'lmaydi' }, { status: 400 })
    }

    // Agar butun buyurtma bekor qilinsa
    if (!itemIds || itemIds.length === 0) {
      // Order'ni cancelled qilish
      await db.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          kitchenStatus: 'cancelled',
        }
      })

      // Sale yozuvi yaratish (cancelled status bilan — hisobdan chiqarish uchun)
      // Bu hisobotlarda ko'rinadi lekin savdo summasiga qo'shilmaydi
      const cancelledTotal = order.total

      // Stolni free qilish (agar bu yagona buyurtma bo'lsa)
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'free' }
      })

      return NextResponse.json({
        success: true,
        message: 'Buyurtma bekor qilindi',
        cancelledTotal,
      })
    }

    // Agar faqat ba'zi taomlar bekor qilinsa (qismiy bekor qilish)
    // OrderItem'larni o'chirish
    for (const itemId of itemIds) {
      const item = order.items.find(i => i.id === itemId)
      if (item) {
        await db.orderItem.delete({ where: { id: itemId } })
        // Order total ni yangilash
        await db.order.update({
          where: { id },
          data: {
            subtotal: { decrement: item.total },
            total: { decrement: item.total },
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${itemIds.length} ta taom bekor qilindi`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
