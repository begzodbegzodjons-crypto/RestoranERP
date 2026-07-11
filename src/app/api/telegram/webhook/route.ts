import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Telegram bot webhook - mijozlar Telegram'dan buyurtma berishi uchun
// Hujjat: https://core.telegram.org/bots/api

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ORDER_BOT_TOKEN || ''

// Telegram webhook'ni o'rnatish
export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      configured: false,
      instructions: 'Telegram bot sozlash uchun .env: TELEGRAM_ORDER_BOT_TOKEN=your_bot_token, so\'ngra /api/telegram/webhook?set=true ni chaqiring'
    })
  }

  const { searchParams } = new URL('http://localhost/api/telegram/webhook?set=true')
  return NextResponse.json({
    configured: true,
    botToken: TELEGRAM_BOT_TOKEN.substring(0, 10) + '...',
    webhookUrl: `${process.env.NEXT_PUBLIC_URL || 'https://restoran-erp.begzodbegzodjons.workers.dev'}/api/telegram/webhook`,
    instructions: 'Webhook o\'rnatish uchun: GET /api/telegram/webhook?set=true'
  })
}

// Webhook o'rnatish yoki xabarlarni qabul qilish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Telegram'dan kelgan xabar
    if (body.message) {
      const chatId = body.message.chat.id
      const text = body.message.text || ''
      const username = body.message.from?.username || body.message.from?.first_name || 'Foydalanuvchi'

      // /start komandasi
      if (text === '/start') {
        await sendTelegramMessage(chatId,
          `🏠 OshxonaERP botiga xush kelibsiz!\n\n` +
          `Buyurtma berish uchun restoran ID sini kiriting.\n` +
          `Masalan: restoran_abc123\n\n` +
          `Yoki /menu buyrug'i bilan menyuni ko'ring.`
        )
        return NextResponse.json({ ok: true })
      }

      // /menu komandasi
      if (text === '/menu') {
        await sendTelegramMessage(chatId,
          `📋 Menu ko'rish uchun restoran ID kerak.\n` +
          `Restoran egasidan ID so'rang.`
        )
        return NextResponse.json({ ok: true })
      }

      // Restoran ID kiritilgan
      if (text.startsWith('restoran_')) {
        const restaurantId = text.replace('restoran_', '')
        const restaurant = await db.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, name: true, products: { where: { isAvailable: true } } }
        })

        if (!restaurant) {
          await sendTelegramMessage(chatId, '❌ Restoran topilmadi')
          return NextResponse.json({ ok: true })
        }

        // Menyu yuborish
        let menuText = `📋 ${restaurant.name} - Menyu\n\n`
        for (const p of restaurant.products.slice(0, 20)) {
          menuText += `${p.imageUrl || '🍽️'} ${p.name} - ${p.price} so'm\n`
        }
        menuText += `\nBuyurtma berish uchun: /order <taom_nomi>`

        await sendTelegramMessage(chatId, menuText)
        return NextResponse.json({ ok: true })
      }

      // Noma'lum komanda
      await sendTelegramMessage(chatId, 'Noma\'lum komanda. /start ni bosing.')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: true }) // Telegram 200 expects
  }
}

// Webhook o'rnatish
export async function PUT(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot token sozlanmagan' }, { status: 400 })
  }

  const url = `${process.env.NEXT_PUBLIC_URL || 'https://restoran-erp.begzodbegzodjons.workers.dev'}/api/telegram/webhook`
  const setRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  const data = await setRes.json()

  return NextResponse.json(data)
}

// Telegram'ga xabar yuborish
async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    })
  } catch (e) {
    console.error('Telegram send error:', e)
  }
}
