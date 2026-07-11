import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/budgets - byudjet ro'yxati
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    const items = await db.budget.findMany({
      where: {
        restaurantId: restaurant.id,
        year,
      },
      orderBy: { month: 'asc' },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/budgets - yangi byudjet qo'shish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { period, year, month, quarter, category, plannedAmount, notes } = body

    if (!year || !category || plannedAmount === undefined) {
      return NextResponse.json({ error: 'year, category va plannedAmount majburiy' }, { status: 400 })
    }

    const budget = await db.budget.create({
      data: {
        restaurantId: restaurant.id,
        period: period || 'monthly',
        year: parseInt(year),
        month: month ? parseInt(month) : null,
        quarter: quarter ? parseInt(quarter) : null,
        category,
        plannedAmount: parseFloat(plannedAmount),
        notes: notes || null,
      }
    })

    return NextResponse.json({ item: budget, message: 'Byudjet qo\'shildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
