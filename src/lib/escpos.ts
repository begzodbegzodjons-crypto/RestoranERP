// ESC/POS thermal printer command library
// ============================================================================
// Xprinter (XP-58IIH, XP-80IIH, XP-350II) va boshqa ESC/POS thermal
// printerlar uchun raw command generator.
//
// Islatish:
//   const data = escpos.buildReceipt({...})
//   await sendToPrinter(device, data)

// ============================================================
// LOW-LEVEL COMMANDS
// ============================================================

const ESC = 0x1B
const GS = 0x1D

// Initialize printer
export const CMD_INIT = new Uint8Array([ESC, 0x40])

// Line feed
export const CMD_LF = new Uint8Array([0x0A])

// Cut paper
export const CMD_CUT = new Uint8Array([GS, 0x56, 0x00])

// Feed n lines then cut
export function cmdFeedAndCut(n: number): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x01, n])
}

// ============================================================
// TEXT FORMATTING
// ============================================================

// Alignment: 0=left, 1=center, 2=right
export function cmdAlign(align: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x61, align])
}

// Bold on/off
export function cmdBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00])
}

// Double size on/off (2x width + 2x height)
export function cmdDoubleSize(on: boolean): Uint8Array {
  return new Uint8Array([GS, 0x21, on ? 0x11 : 0x00])
}

// ============================================================
// HELPERS
// ============================================================

function str(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

function pad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  if (text.length >= width) return text.substring(0, width)
  const pad = width - text.length
  if (align === 'right') return ' '.repeat(pad) + text
  if (align === 'center') {
    const left = Math.floor(pad / 2)
    return ' '.repeat(left) + text + ' '.repeat(pad - left)
  }
  return text + ' '.repeat(pad)
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount))
}

function separator(width: number): string {
  return '-'.repeat(width)
}

// ============================================================
// RECEIPT BUILDERS
// ============================================================

export interface ReceiptItem {
  name: string
  qty: number
  price?: number
  notes?: string | null
}

export interface KitchenOrderData {
  orderNo: string
  table: string
  waiter: string
  createdAt: string
  items: ReceiptItem[]
  printerStationName: string
  restaurantName?: string
}

export interface PaymentReceiptData {
  invoiceNo: string
  table: string
  waiter: string
  cashier?: string
  createdAt: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  serviceCharge: number
  taxAmount: number
  total: number
  paymentMethod: string
  restaurantName: string
  restaurantPhone?: string | null
}

// ============================================================
// KITCHEN ORDER RECEIPT (oshpaz/shashlikchi/muzqaymoqchi uchun)
// ============================================================
export function buildKitchenReceipt(data: KitchenOrderData, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []

  parts.push(CMD_INIT)

  // Restaurant name (center, bold, double)
  if (data.restaurantName) {
    parts.push(cmdAlign(1))
    parts.push(cmdBold(true))
    parts.push(cmdDoubleSize(true))
    parts.push(str(data.restaurantName + '\n'))
    parts.push(cmdDoubleSize(false))
    parts.push(cmdBold(false))
  }

  // Station name (center, bold, double) - eng katta yozuv
  parts.push(cmdAlign(1))
  parts.push(cmdBold(true))
  parts.push(cmdDoubleSize(true))
  parts.push(str(data.printerStationName + '\n'))
  parts.push(cmdDoubleSize(false))
  parts.push(cmdBold(false))

  // Separator
  parts.push(cmdAlign(0))
  parts.push(str(separator(width) + '\n'))

  // Order info
  parts.push(cmdBold(true))
  parts.push(str(`Buyurtma: ${data.orderNo}\n`))
  parts.push(str(`Stol: ${data.table}\n`))
  parts.push(str(`Ofitsiant: ${data.waiter}\n`))
  parts.push(str(`Vaqt: ${new Date(data.createdAt).toLocaleString('uz-UZ')}\n`))
  parts.push(cmdBold(false))

  parts.push(str(separator(width) + '\n'))

  // Items - har bir taom alohida, katta shrift bilan
  parts.push(cmdBold(true))
  parts.push(str('TAOMLAR:\n'))
  parts.push(cmdBold(false))

  for (const item of data.items) {
    // Miqdor va nom - katta shrift (double size)
    parts.push(cmdDoubleSize(true))
    parts.push(str(`${item.qty} x ${item.name}\n`))
    parts.push(cmdDoubleSize(false))

    // Izoh (masalan: "achchiqroq qiling")
    if (item.notes) {
      parts.push(str(`   >> ${item.notes}\n`))
    }
  }

  parts.push(str(separator(width) + '\n'))

  // Footer
  parts.push(cmdAlign(1))
  parts.push(str(`${new Date().toLocaleTimeString('uz-UZ')}\n`))

  // Feed and cut
  parts.push(new Uint8Array([GS, 0x56, 0x01, 0x03]))  // feed 3 lines + cut

  return concat(...parts)
}

// ============================================================
// PAYMENT RECEIPT (kassa chek)
// ============================================================
export function buildPaymentReceipt(data: PaymentReceiptData, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []

  parts.push(CMD_INIT)

  // Restaurant name (center, bold, double)
  parts.push(cmdAlign(1))
  parts.push(cmdBold(true))
  parts.push(cmdDoubleSize(true))
  parts.push(str(data.restaurantName + '\n'))
  parts.push(cmdDoubleSize(false))
  parts.push(cmdBold(false))

  if (data.restaurantPhone) {
    parts.push(str(`Tel: ${data.restaurantPhone}\n`))
  }

  // Separator
  parts.push(cmdAlign(0))
  parts.push(str(separator(width) + '\n'))

  // Invoice info
  parts.push(str(`Chek: ${data.invoiceNo}\n`))
  parts.push(str(`Stol: ${data.table}\n`))
  parts.push(str(`Ofitsiant: ${data.waiter}\n`))
  if (data.cashier) {
    parts.push(str(`Kassir: ${data.cashier}\n`))
  }
  parts.push(str(`Vaqt: ${new Date(data.createdAt).toLocaleString('uz-UZ')}\n`))

  parts.push(str(separator(width) + '\n'))

  // Items
  for (const item of data.items) {
    const nameLine = item.name.length > width - 12 ? item.name.substring(0, width - 12) : item.name
    const qtyStr = `${item.qty}`
    const totalStr = item.price ? formatMoney(item.price * item.qty) : '-'

    parts.push(str(
      pad(nameLine, width - 12) +
      pad(qtyStr, 5, 'right') +
      pad(totalStr, 7, 'right') +
      '\n'
    ))
  }

  parts.push(str(separator(width) + '\n'))

  // Totals - right aligned
  parts.push(cmdAlign(2))
  parts.push(str(`Jami: ${formatMoney(data.subtotal)}\n`))
  if (data.discount > 0) {
    parts.push(str(`Chegirma: -${formatMoney(data.discount)}\n`))
  }
  if (data.serviceCharge > 0) {
    parts.push(str(`Xizmat: +${formatMoney(data.serviceCharge)}\n`))
  }
  if (data.taxAmount > 0) {
    parts.push(str(`QQS: +${formatMoney(data.taxAmount)}\n`))
  }

  parts.push(str(separator(width) + '\n'))

  // Total - big and bold
  parts.push(cmdBold(true))
  parts.push(cmdDoubleSize(true))
  parts.push(str(`TO'LOV: ${formatMoney(data.total)}\n`))
  parts.push(cmdDoubleSize(false))
  parts.push(cmdBold(false))

  // Payment method
  const methodLabels: Record<string, string> = {
    cash: 'Naqd',
    card: 'Karta',
    transfer: 'O\'tkazma',
    split: 'Bo\'lib to\'lash'
  }
  parts.push(str(`${methodLabels[data.paymentMethod] || data.paymentMethod}\n`))

  parts.push(str(separator(width) + '\n'))

  // Footer
  parts.push(cmdAlign(1))
  parts.push(cmdDoubleSize(true))
  parts.push(str('RAHMAT!\n'))
  parts.push(cmdDoubleSize(false))
  parts.push(str('Yangi kelishingizni kutamiz\n'))

  // Feed and cut
  parts.push(new Uint8Array([GS, 0x56, 0x01, 0x03]))

  return concat(...parts)
}

// ============================================================
// TEST PRINT
// ============================================================
export function buildTestReceipt(printerName: string, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []

  parts.push(CMD_INIT)

  // Title
  parts.push(cmdAlign(1))
  parts.push(cmdBold(true))
  parts.push(cmdDoubleSize(true))
  parts.push(str('TEST CHEK\n'))
  parts.push(cmdDoubleSize(false))
  parts.push(cmdBold(false))

  parts.push(str(separator(width) + '\n'))

  // Info
  parts.push(cmdAlign(0))
  parts.push(str(`Printer: ${printerName}\n`))
  parts.push(str(`Vaqt: ${new Date().toLocaleString('uz-UZ')}\n`))
  parts.push(str(separator(width) + '\n'))

  // Test text - har xil formatlar
  parts.push(str('Oddiy matn\n'))
  parts.push(cmdBold(true))
  parts.push(str('Qalin matn\n'))
  parts.push(cmdBold(false))
  parts.push(cmdDoubleSize(true))
  parts.push(str('Katta matn\n'))
  parts.push(cmdDoubleSize(false))

  parts.push(cmdAlign(1))
  parts.push(str('Markazda\n'))
  parts.push(cmdAlign(2))
  parts.push(str('O\'ngda\n'))
  parts.push(cmdAlign(0))

  parts.push(str(separator(width) + '\n'))

  parts.push(cmdAlign(1))
  parts.push(cmdBold(true))
  parts.push(str('✓ PRINTER ISHLAYAPTI\n'))
  parts.push(cmdBold(false))
  parts.push(str('Chek chop etish tayyor\n'))

  parts.push(new Uint8Array([GS, 0x56, 0x01, 0x03]))

  return concat(...parts)
}
