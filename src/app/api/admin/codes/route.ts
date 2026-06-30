import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateActivationCode } from '@/lib/auth'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/admin/codes - barcha aktivatsiya kodlari ro'yxati
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const codes = await db.activationCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500
    })

    // Include restaurant info for used codes
    const usedRestaurantIds = codes.filter(c => c.usedBy).map(c => c.usedBy!)
    const restaurants = usedRestaurantIds.length > 0
      ? await db.restaurant.findMany({ where: { id: { in: usedRestaurantIds } } })
      : []
    const restMap = new Map(restaurants.map(r => [r.id, r]))

    return NextResponse.json({
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        status: c.status,
        validDays: c.validDays,
        createdAt: c.createdAt,
        usedAt: c.usedAt,
        expiresAt: c.expiresAt,
        usedBy: c.usedBy,
        usedByRestaurant: c.usedBy ? restMap.get(c.usedBy)?.name : null
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/admin/codes - yangi aktivatsiya kodi generatsiya qilish
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50)
    const validDays = body.validDays ? Math.min(Math.max(parseInt(body.validDays), 1), 365) : 30

    const created: any[] = []
    for (let i = 0; i < count; i++) {
      // Ensure unique code
      let code = generateActivationCode()
      let tries = 0
      while (true) {
        const existing = await db.activationCode.findUnique({ where: { code } })
        if (!existing) break
        code = generateActivationCode()
        tries++
        if (tries > 100) break
      }

      const ac = await db.activationCode.create({
        data: {
          code,
          status: 'unused',
          validDays
        }
      })
      created.push(ac)
    }

    await db.adminLog.create({
      data: {
        action: 'generate_codes',
        detail: `Generated ${count} codes, valid ${validDays} days`
      }
    })

    return NextResponse.json({
      success: true,
      codes: created.map(c => ({
        id: c.id,
        code: c.code,
        validDays: c.validDays,
        createdAt: c.createdAt
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
