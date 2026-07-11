import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/branches/[id] - bitta filial
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const item = await db.branch.findUnique({ where: { id } })
    if (!item || item.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/branches/[id] - filialni yangilash
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, address, phone } = body

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing || existing.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const updated = await db.branch.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        address: address ?? existing.address,
        phone: phone ?? existing.phone,
      }
    })

    return NextResponse.json({ item: updated, message: 'Filial yangilandi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/branches/[id] - filialni o'chirish
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { id } = await params
    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing || existing.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await db.branch.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Filial o\'chirildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
