import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/inventory-counts/[id] - bitta inventarizatsiya
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const item = await db.inventoryCount.findUnique({ where: { id } })
    if (!item || item.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    return NextResponse.json({
      item: {
        ...item,
        items: item.items ? JSON.parse(item.items) : []
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/inventory-counts/[id] - inventarizatsiyani yangilash / yakunlash
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { items, action, notes } = body

    const count = await db.inventoryCount.findUnique({ where: { id } })
    if (!count || count.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    if (action === 'complete' && items) {
      // Yakunlash - farqlarni qo'llash
      for (const item of items) {
        if (item.ingredientId && item.actualQty !== item.expectedQty) {
          const diff = item.actualQty - item.expectedQty
          await db.ingredient.update({
            where: { id: item.ingredientId },
            data: { stock: item.actualQty }
          })
          // InventoryItem yozuvi - adjustment
          await db.inventoryItem.create({
            data: {
              restaurantId: restaurant.id,
              ingredientId: item.ingredientId,
              type: 'adjustment',
              quantity: Math.abs(diff),
              unitPrice: 0,
              reason: `Inventarizatsiya: ${diff > 0 ? 'ortiqcha' : 'kamomad'}`,
              refType: 'InventoryCount',
              refId: id,
            }
          })
        }
      }

      await db.inventoryCount.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          items: JSON.stringify(items),
          notes: notes || count.notes,
        }
      })

      return NextResponse.json({ message: 'Inventarizatsiya yakunlandi' })
    }

    // Faqat items'ni saqlash (draft)
    await db.inventoryCount.update({
      where: { id },
      data: {
        items: items ? JSON.stringify(items) : count.items,
        notes: notes || count.notes,
      }
    })

    return NextResponse.json({ message: 'Saqlandi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
