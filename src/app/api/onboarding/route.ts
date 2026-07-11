import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/onboarding - onboarding holati va qadamlari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    // Onboarding qadamlari
    const steps = [
      { id: 1, key: 'profile', title: 'Restoran profilini to\'ldiring', completed: !!(restaurant.name && restaurant.email && restaurant.phone) },
      { id: 2, key: 'settings', title: 'Soliq va xizmat foizini sozlang', completed: !!(restaurant.vatRate !== undefined || restaurant.serviceChargePercent !== undefined) },
      { id: 3, key: 'categories', title: 'Kategoriyalar qo\'shing', completed: false },
      { id: 4, key: 'products', title: 'Taomlar qo\'shing', completed: false },
      { id: 5, key: 'ingredients', title: 'Ombor mahsulotlari qo\'shing', completed: false },
      { id: 6, key: 'tables', title: 'Stollar va xonalar sozlang', completed: false },
      { id: 7, key: 'staff', title: 'Xodimlar qo\'shing', completed: false },
      { id: 8, key: 'done', title: 'Tayyor!', completed: restaurant.onboardingCompleted },
    ]

    // Real holatni tekshirish
    const [categories, products, ingredients, tables, staff] = await Promise.all([
      db.category.count({ where: { restaurantId: restaurant.id } }),
      db.product.count({ where: { restaurantId: restaurant.id } }),
      db.ingredient.count({ where: { restaurantId: restaurant.id } }),
      db.restaurantTable.count({ where: { restaurantId: restaurant.id } }),
      db.staff.count({ where: { restaurantId: restaurant.id } }),
    ])

    steps[2].completed = categories > 0
    steps[3].completed = products > 0
    steps[4].completed = ingredients > 0
    steps[5].completed = tables > 0
    steps[6].completed = staff > 0

    const completedCount = steps.filter(s => s.completed).length
    const nextStep = steps.find(s => !s.completed)
    const progress = Math.round((completedCount / steps.length) * 100)

    return NextResponse.json({
      onboardingCompleted: restaurant.onboardingCompleted,
      currentStep: restaurant.onboardingStep,
      progress,
      completedCount,
      totalSteps: steps.length,
      nextStep,
      steps,
      counts: { categories, products, ingredients, tables, staff }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/onboarding - onboarding qadamini yangilash yoki yakunlash
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { action, step } = body

    if (action === 'complete') {
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: {
          onboardingCompleted: true,
          onboardingStep: 8,
        }
      })
      return NextResponse.json({ success: true, message: 'Onboarding yakunlandi!' })
    }

    if (action === 'skip') {
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: { onboardingCompleted: true }
      })
      return NextResponse.json({ success: true, message: 'Onbooking o\'tkazib yuborildi' })
    }

    if (step !== undefined) {
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: { onboardingStep: parseInt(step) }
      })
      return NextResponse.json({ success: true, step: parseInt(step) })
    }

    return NextResponse.json({ error: 'action yoki step kerak' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
