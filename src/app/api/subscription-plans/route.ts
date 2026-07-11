import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/subscription-plans - obuna tariflari ro'yxati
export async function GET() {
  try {
    let items = await db.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    })

    if (items.length === 0) {
      const defaults = [
        {
          name: 'Basic',
          priceMonthly: 99000,
          priceYearly: 990000,
          maxProducts: 50,
          maxStaff: 5,
          maxBranches: 1,
          features: JSON.stringify([
            'POS kassa', 'Menyu boshqaruvi', 'Ombor hisobi',
            'Mijozlar CRM', 'Savdo tarixi', 'Basic hisobotlar'
          ])
        },
        {
          name: 'Pro',
          priceMonthly: 199000,
          priceYearly: 1990000,
          maxProducts: 500,
          maxStaff: 20,
          maxBranches: 3,
          features: JSON.stringify([
            'Basic funksiyalari +',
            'AI savdo prognozi', 'Menu engineering',
            'Sodiqlik dasturi', 'SMS marketing',
            'Moliyaviy hisobotlar', 'A/B testlash', 'API access'
          ])
        },
        {
          name: 'Enterprise',
          priceMonthly: 499000,
          priceYearly: 4990000,
          maxProducts: 10000,
          maxStaff: 100,
          maxBranches: 20,
          features: JSON.stringify([
            'Pro funksiyalari +',
            'Cheksiz filiallar', 'White-label branding',
            '1C integratsiya', 'Telegram bot',
            'Premium support', 'Custom integratsiyalar'
          ])
        },
      ]
      for (const p of defaults) {
        await db.subscriptionPlan.create({ data: p })
      }
      items = await db.subscriptionPlan.findMany({ orderBy: { priceMonthly: 'asc' } })
    }

    return NextResponse.json({
      items: items.map((p: any) => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : []
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/subscription-plans - yangi tarif qo'shish (faqat admin)
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Admin avtorizatsiyasi talab qilinadi' }, { status: 401 })
    }

    const body = await req.json()
    const { name, priceMonthly, priceYearly, maxProducts, maxStaff, maxBranches, features } = body

    if (!name) {
      return NextResponse.json({ error: 'Tarif nomi majburiy' }, { status: 400 })
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        priceMonthly: parseFloat(priceMonthly) || 0,
        priceYearly: parseFloat(priceYearly) || 0,
        maxProducts: parseInt(maxProducts) || 100,
        maxStaff: parseInt(maxStaff) || 10,
        maxBranches: parseInt(maxBranches) || 1,
        features: JSON.stringify(features || []),
      }
    })

    return NextResponse.json({ item: plan, message: 'Tarif yaratildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
