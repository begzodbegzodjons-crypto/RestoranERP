import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/branding - restoran branding sozlamalari
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    return NextResponse.json({
      branding: {
        customLogoUrl: restaurant.customLogoUrl,
        customPrimaryColor: restaurant.customPrimaryColor || '#10b981',
        customDomain: restaurant.customDomain,
        name: restaurant.name,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/branding - branding sozlash
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { customLogoUrl, customPrimaryColor, customDomain } = body

    const updateData: any = {}
    if (customLogoUrl !== undefined) updateData.customLogoUrl = customLogoUrl || null
    if (customPrimaryColor !== undefined) updateData.customPrimaryColor = customPrimaryColor
    if (customDomain !== undefined) updateData.customDomain = customDomain || null

    const updated = await db.restaurant.update({
      where: { id: restaurant.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      branding: {
        customLogoUrl: updated.customLogoUrl,
        customPrimaryColor: updated.customPrimaryColor,
        customDomain: updated.customDomain,
      },
      message: 'Branding yangilandi'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
