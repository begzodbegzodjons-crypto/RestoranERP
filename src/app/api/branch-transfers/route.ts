import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/branch-transfers - filiallararo transferlar ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.branchTransfer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    })

    // Branch nomlarini olish
    const branchIds = new Set<string>()
    for (const t of items) {
      if (t.fromBranchId) branchIds.add(t.fromBranchId)
      if (t.toBranchId) branchIds.add(t.toBranchId)
    }
    const branches = branchIds.size > 0
      ? await db.branch.findMany({ where: { id: { in: Array.from(branchIds) } } })
      : []
    const branchMap = new Map(branches.map((b: any) => [b.id, b.name]))

    return NextResponse.json({
      items: items.map((t: any) => ({
        ...t,
        items: t.items ? JSON.parse(t.items) : [],
        fromBranchName: t.fromBranchId ? branchMap.get(t.fromBranchId) : null,
        toBranchName: t.toBranchId ? branchMap.get(t.toBranchId) : null,
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/branch-transfers - yangi transfer yaratish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { fromBranchId, toBranchId, items, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Kamida bitta mahsulot kerak' }, { status: 400 })
    }

    if (!fromBranchId && !toBranchId) {
      return NextResponse.json({ error: 'fromBranchId yoki toBranchId kerak' }, { status: 400 })
    }

    // Transfer yaratish
    const transfer = await db.branchTransfer.create({
      data: {
        restaurantId: restaurant.id,
        fromBranchId: fromBranchId || null,
        toBranchId: toBranchId || null,
        status: 'pending',
        items: JSON.stringify(items),
        notes: notes || null,
      }
    })

    // Agar darhol yuborish kerak bo'lsa - ingredientlarni kamaytirish
    if (fromBranchId) {
      for (const item of items) {
        if (item.ingredientId) {
          await db.ingredient.update({
            where: { id: item.ingredientId },
            data: { stock: { decrement: item.quantity } }
          })
          await db.inventoryItem.create({
            data: {
              restaurantId: restaurant.id,
              ingredientId: item.ingredientId,
              type: 'out',
              quantity: item.quantity,
              unitPrice: 0,
              reason: 'branch_transfer',
              refType: 'BranchTransfer',
              refId: transfer.id,
            }
          })
        }
      }
      await db.branchTransfer.update({
        where: { id: transfer.id },
        data: { status: 'in_transit', sentAt: new Date() }
      })
    }

    return NextResponse.json({ item: transfer, message: 'Transfer yaratildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
