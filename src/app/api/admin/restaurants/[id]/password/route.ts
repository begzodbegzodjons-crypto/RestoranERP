import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { hashPassword } from '@/lib/auth'

// GET /api/admin/restaurants/[id]/password
// Admin foydalanuvchi parolini ko'rish (faqat o'qish)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const restaurant = await db.restaurant.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, passwordHash: true }
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    // Hash format: salt:hash (PBKDF2)
    // Eslatma: parol bir tomonlama shifrlangan (one-way hash),
    // uni qaytarib olish mumkin emas. Lekin admin foydalanuvchining
    // email/loginini ko'ra oladi va parolni qayta o'rnatishi mumkin.
    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
        passwordHash: restaurant.passwordHash,
        passwordNote: 'Parol xavfsizlik sababli shifrlangan (PBKDF2) va qaytarib o\'rish mumkin emas. Yangi parol o\'rnatish uchun "Parolni qayta o\'rnatish" tugmasini bosing.'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/admin/restaurants/[id]/password
// Admin foydalanuvchi parolini qayta o'rnatish (yangi parol beradi)
// Body: { newPassword?: string } - agar berilmasa, avtomatik 8 raqamli parol generatsiya qilinadi
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    // Yangi parol - agar body'da berilmasa, avtomatik generatsiya qilamiz
    let newPassword = body.newPassword
    if (!newPassword) {
      // 8 raqamli tasodifiy parol
      newPassword = Math.floor(10000000 + Math.random() * 90000000).toString()
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' }, { status: 400 })
    }

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })
    }

    // Yangi parolni hash'lash va saqlash
    const passwordHash = hashPassword(newPassword)
    await db.restaurant.update({
      where: { id },
      data: { passwordHash }
    })

    // Admin log
    await db.adminLog.create({
      data: {
        action: 'reset_password',
        detail: `Admin reset password for ${restaurant.email}`
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Parol muvaffaqiyatli yangilandi',
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email
      },
      newPassword, // Admin'ga yangi parol ko'rsatiladi (u foydalanuvchiga yuboradi)
      note: 'Yangi parolni foydalanuvchiga Telegram orqali yuboring.'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
