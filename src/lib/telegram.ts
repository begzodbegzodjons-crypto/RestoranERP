// Telegram notification helpers
// ============================================================================
// Barcha xabarlar @norinkomp admin'iga yuboriladi (foydalanuvchining botiga EMAS).
//
// Sozlash:
// 1. @BotFather bilan yangi bot yarating (yoki mavjud botni ishlating)
// 2. Bot token'ini olint: ADMIN_TELEGRAM_BOT_TOKEN
// 3. @norinkomp akkaunti bilan botga /start yuboring
// 4. https://api.telegram.org/bot<TOKEN>/getUpdates - chat_id oling
// 5. ADMIN_TELEGRAM_CHAT_ID sifatida saqlang
//
// Flow:
// - Foydalanuvchi bloklanganda -> admin (@norinkomp) ga xabar boradi
// - Foydalanuvchi @norinkomp ga yozadi -> to'lov qiladi
// - Admin paneldan aktivatsiya kodi generatsiya qiladi
// - Admin @norinkomp orqali foydalanuvchiga kodni yuboradi
// - Foydalanuvchi kodni dasturga kiritadi -> 30 kun aktivlashadi

interface AdminTelegramConfig {
  botToken?: string
  chatId?: string
}

/**
 * Admin telegram config'ni env'dan olish
 */
function getAdminConfig(): AdminTelegramConfig {
  return {
    botToken: process.env.ADMIN_TELEGRAM_BOT_TOKEN,
    chatId: process.env.ADMIN_TELEGRAM_CHAT_ID,
  }
}

/**
 * Telegram xabar yuborish (admin'ga)
 * @param text - yuboriladigan xabar matni (HTML format)
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = getAdminConfig()
  if (!config.botToken || !config.chatId) {
    // Bot sozlanmagan - hech narsa qilmaydi (silent fail)
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
 * Admin'ga "sinov muddati tugadi" xabari
 * @param restaurant - bloklangan restoran ma'lumotlari
 */
export async function notifyTrialExpired(restaurant: {
  id: string
  name: string
  email: string
  phone?: string | null
  trialEnd: Date
}): Promise<boolean> {
  const text = `🚫 <b>Sinov muddati tugadi</b>

🏪 <b>Restoran:</b> ${restaurant.name}
📧 <b>Email:</b> ${restaurant.email}
${restaurant.phone ? `📞 <b>Telefon:</b> ${restaurant.phone}\n` : ''}📅 <b>Sinov tugashi:</b> ${new Date(restaurant.trialEnd).toLocaleDateString('uz-UZ')}
🆔 <b>ID:</b> <code>${restaurant.id}</code>

Foydalanuvchi tez orada sizga @norinkomp orqali murojaat qiladi.
To'lov qabul qilib, aktivatsiya kodini yuboring.`

  return sendTelegramMessage(text)
}

/**
 * Admin'ga "aktivatsiya muvaffaqiyatli" xabari
 */
export async function notifyActivated(
  restaurant: { id: string; name: string; email: string; phone?: string | null },
  code: string,
  daysLeft: number,
  endDate: Date
): Promise<boolean> {
  const text = `✅ <b>Dastur faollashtirildi</b>

🏪 <b>Restoran:</b> ${restaurant.name}
📧 <b>Email:</b> ${restaurant.email}
${restaurant.phone ? `📞 <b>Telefon:</b> ${restaurant.phone}\n` : ''}🔑 <b>Kod:</b> <code>${code}</code>
📅 <b>Faollik:</b> ${daysLeft} kun
📆 <b>Tugash sanasi:</b> ${endDate.toLocaleDateString('uz-UZ')}

Aktivatsiya muvaffaqiyatli amalga oshirildi.`

  return sendTelegramMessage(text)
}

/**
 * Admin'ga "aktivatsiya muddati tugadi" xabari
 */
export async function notifyActivationExpired(restaurant: {
  id: string
  name: string
  email: string
  phone?: string | null
  activationEnd: Date | null
}): Promise<boolean> {
  const text = `🚫 <b>Aktivatsiya muddati tugadi</b>

🏪 <b>Restoran:</b> ${restaurant.name}
📧 <b>Email:</b> ${restaurant.email}
${restaurant.phone ? `📞 <b>Telefon:</b> ${restaurant.phone}\n` : ''}📅 <b>Aktivatsiya tugashi:</b> ${restaurant.activationEnd ? new Date(restaurant.activationEnd).toLocaleDateString('uz-UZ') : '-'}
🆔 <b>ID:</b> <code>${restaurant.id}</code>

Foydalanuvchi yangi aktivatsiya kodi olish uchun sizga @norinkomp orqali murojaat qiladi.
To'lov qabul qilib, yangi aktivatsiya kodini yuboring.`

  return sendTelegramMessage(text)
}

/**
 * Admin'ga "yangi foydalanuvchi ro'yxatdan o'tdi" xabari ( statistika uchun)
 */
export async function notifyNewRegistration(restaurant: {
  id: string
  name: string
  email: string
  phone?: string | null
}): Promise<boolean> {
  const text = `🆕 <b>Yangi ro'yxatdan o'tgan foydalanuvchi</b>

🏪 <b>Restoran:</b> ${restaurant.name}
📧 <b>Email:</b> ${restaurant.email}
${restaurant.phone ? `📞 <b>Telefon:</b> ${restaurant.phone}\n` : ''}🆔 <b>ID:</b> <code>${restaurant.id}</code>
📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}

10 kunlik bepul sinov boshlandi.`

  return sendTelegramMessage(text)
}
