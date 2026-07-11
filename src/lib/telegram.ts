// Telegram notification helpers
// ============================================================================
// Restoran uchun telegram bot token va chat ID berilgan bo'lsa,
// xabar yuboradi. Agar berilmagan bo'lsa - hech narsa qilmaydi (no-op).

interface TelegramConfig {
  botToken?: string | null
  chatId?: string | null
}

/**
 * Telegram xabar yuborish
 * @param config - telegram config (botToken, chatId)
 * @param text - yuboriladigan xabar matni
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string
): Promise<boolean> {
  if (!config.botToken || !config.chatId) {
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      console.error('[telegram] Xato:', await res.text())
      return false
    }
    return true
  } catch (e: any) {
    console.error('[telegram] Exception:', e.message)
    return false
  }
}

/**
 * Restoran egasiga "sinov muddati tugadi" xabari yuborish
 * @param restaurant - restoran ma'lumotlari (name, telegramBotToken, telegramChatId)
 */
export async function notifyTrialExpired(restaurant: {
  name: string
  email: string
  telegramBotToken?: string | null
  telegramChatId?: string | null
}): Promise<boolean> {
  const text = `🚫 <b>Sinov muddati tugadi</b>

Hurmatli <b>${restaurant.name}</b>!

OshxonaERP dasturining bepul sinov muddati tugadi.

Dasturdan foydalanishni davom ettirish uchun:
1. Admin paneldan aktivatsiya kodini oling
2. @norinkomp telegram akkauntiga murojaat qiling
3. Aktivatsiya kodini dasturga kiriting

✅ Aktivatsiya kodi 30 kunlik foydalanish huquqini beradi.

Murojaat: @norinkomp`

  return sendTelegramMessage(
    { botToken: restaurant.telegramBotToken, chatId: restaurant.telegramChatId },
    text
  )
}

/**
 * Restoran egasiga "aktivatsiya muvaffaqiyatli" xabari yuborish
 */
export async function notifyActivated(
  restaurant: { name: string; telegramBotToken?: string | null; telegramChatId?: string | null },
  daysLeft: number,
  endDate: Date
): Promise<boolean> {
  const text = `✅ <b>Dastur faollashtirildi</b>

Hurmatli <b>${restaurant.name}</b>!

Sizning OshxonaERP dasturingiz muvaffaqiyatli faollashtirildi.

📅 Faollik muddati: <b>${daysLeft} kun</b>
📆 Tugash sanasi: <b>${endDate.toLocaleDateString('uz-UZ')}</b>

Muddati tugagach dastur avtomatik bloklanadi.
Davom ettirish uchun yangi aktivatsiya kodi oling.

Murojaat: @norinkomp`

  return sendTelegramMessage(
    { botToken: restaurant.telegramBotToken, chatId: restaurant.telegramChatId },
    text
  )
}

/**
 * Restoran egasiga "aktivatsiya muddati tugadi" xabari yuborish
 */
export async function notifyActivationExpired(restaurant: {
  name: string
  email: string
  telegramBotToken?: string | null
  telegramChatId?: string | null
}): Promise<boolean> {
  const text = `🚫 <b>Aktivatsiya muddati tugadi</b>

Hurmatli <b>${restaurant.name}</b>!

Sizning OshxonaERP dasturingizning aktivatsiya muddati tugadi.
Dastur vaqtincha bloklandi.

Davom ettirish uchun:
1. Yangi aktivatsiya kodi oling
2. @norinkomp telegram akkauntiga murojaat qiling
3. Aktivatsiya kodini dasturga kiriting

Murojaat: @norinkomp`

  return sendTelegramMessage(
    { botToken: restaurant.telegramBotToken, chatId: restaurant.telegramChatId },
    text
  )
}
