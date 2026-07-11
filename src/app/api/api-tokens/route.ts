import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import crypto from 'crypto'

// GET /api/api-tokens - restoran API tokenlari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.apiToken.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    })

    // Token'ni qisqartirib ko'rsatish (xavfsizlik)
    const safeItems = items.map((t: any) => ({
      ...t,
      token: t.token.substring(0, 8) + '...' + t.token.substring(t.token.length - 4)
    }))

    return NextResponse.json({ items: safeItems })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/api-tokens - yangi API token yaratish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { name, scope, expiresAt } = body

    if (!name) {
      return NextResponse.json({ error: 'name majburiy' }, { status: 400 })
    }

    // Tasodifiy token generatsiya qilish
    const token = 'oerp_' + crypto.randomBytes(32).toString('hex')

    const item = await db.apiToken.create({
      data: {
        restaurantId: restaurant.id,
        name,
        token,
        scope: scope || 'read',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }
    })

    // Token'ni faqat bir marta to'liq ko'rsatish
    return NextResponse.json({
      item,
      token,
      message: 'API token yaratildi. Bu tokenni nusxalang - qayta ko\'rsatilmaydi!'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/api-tokens - token o'chirish
export async function DELETE(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id kerak' }, { status: 400 })

    await db.apiToken.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Token o\'chirildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
