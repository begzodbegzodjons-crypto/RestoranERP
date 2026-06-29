import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActivationEnd, getAccessStatus } from '@/lib/auth'
import { cookies } from 'next/headers'

// POST /api/activation/activate - Aktivatsiya kodini faollashtirish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body

    if (!code) {
      return NextResponse.json({ error: 'Aktivatsiya kodini kiriting' }, { status: 400 })
    }

    // Normalize code (8 digits)
    const normalizedCode = code.toString().trim()

    // Only accept exact 8-digit numeric codes
    if (!/^\d{8}$/.test(normalizedCode)) {
      return NextResponse.json({ error: 'Noto\'g\'ri kod formati. Aktivatsiya kodi 8 ta raqamdan iborat bo\'lishi kerak.' }, { status: 400 })
    }

    // Find the code
    const activationCode = await db.activationCode.findUnique({
      where: { code: normalizedCode }
    })

    if (!activationCode) {
      return NextResponse.json({ error: 'Noto\'g\'ri aktivatsiya kodi. Iltimos, @norinkomp telegram akkauntiga murojaat qiling.' }, { status: 400 })
    }

    if (activationCode.status === 'used') {
      return NextResponse.json({ error: 'Bu aktivatsiya kodi allaqachon ishlatilgan. Har bir kod faqat bitta restoran uchun amal qiladi.' }, { status: 400 })
    }

    // Get current restaurant from session
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Avval tizimga kiring' }, { status: 401 })
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { restaurant: true }
    })
    if (!session) {
      return NextResponse.json({ error: 'Sessiya topilmadi' }, { status: 401 })
    }

    const restaurant = session.restaurant

    // Mark code as used
    const now = new Date()
    const activationEnd = getActivationEnd()

    await db.$transaction([
      db.activationCode.update({
        where: { id: activationCode.id },
        data: {
          status: 'used',
          usedBy: restaurant.id,
          usedAt: now,
          expiresAt: activationEnd
        }
      }),
      db.restaurant.update({
        where: { id: restaurant.id },
        data: {
          status: 'active',
          activatedAt: now,
          activationEnd: activationEnd,
          activationCode: normalizedCode
        }
      })
    ])

    const updated = await db.restaurant.findUnique({ where: { id: restaurant.id } })

    return NextResponse.json({
      success: true,
      message: `Dastur muvaffaqiyatli faollashtirildi! ${activationCode.validDays} kun foydalanishingiz mumkin.`,
      access: updated ? getAccessStatus(updated) : null
    })
  } catch (e: any) {
    console.error('Activation error:', e)
    return NextResponse.json({ error: 'Server xatosi: ' + e.message }, { status: 500 })
  }
}
