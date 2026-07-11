import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/marketing/campaigns - marketing kampaniyalar
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.marketingCampaign.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/marketing/campaigns - yangi kampaniya yaratish
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { channel, title, message, targetAudience, scheduledAt } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title va message majburiy' }, { status: 400 })
    }

    const campaign = await db.marketingCampaign.create({
      data: {
        restaurantId: restaurant.id,
        channel: channel || 'sms',
        title,
        message,
        targetAudience: targetAudience || 'all',
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      }
    })

    // Agar darhol yuborish kerak bo'lsa (status: draft emas)
    // Hozircha faqat yaratamiz - yuborish alohida endpoint orqali
    return NextResponse.json({ item: campaign, message: 'Kampaniya yaratildi' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
