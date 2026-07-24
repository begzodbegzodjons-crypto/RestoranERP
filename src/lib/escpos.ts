// ESC/POS thermal printer command library
// ============================================================================
// Xprinter (XP-58IIH, XP-80IIH, XP-350II) va boshqa ESC/POS thermal
// printerlar uchun raw command generator.
//
// Hujjat: https://escpos.readthedocs.io/
//
// Islatish:
//   const data = escpos.buildReceipt({
//     header: 'OSHXONA ERP',
//     items: [{ name: 'Manti', qty: 5, price: 25000 }],
//     total: 125000,
//     footer: 'Rahmat!'
//   })
//   await sendToPrinter(device, data)

// ============================================================
// LOW-LEVEL COMMANDS
// ============================================================

// Initialize printer
export const ESC_INIT = new Uint8Array([0x1B, 0x40])

// Line feed
export const LF = new Uint8Array([0x0A])

// Cut paper (partial cut)
export const ESC_CUT = new Uint8Array([0x1D, 0x56, 0x01])

// Cut paper (full cut)
export const ESC_CUT_FULL = new Uint8Array([0x1D, 0x56, 0x00])

// Feed n lines
export function feedLines(n: number): Uint8Array {
  return new Uint8Array([0x1B, 0x64, n])
}

// ============================================================
// TEXT FORMATTING
// ============================================================

// Alignment: 0=left, 1=center, 2=right
export function setAlign(align: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1B, 0x61, align])
}

// Bold on/off
export function setBold(on: boolean): Uint8Array {
  return new Uint8Array([0x1B, 0x45, on ? 0x01 : 0x00])
}

// Double width/height
export function setDoubleSize(on: boolean): Uint8Array {
  return new Uint8Array([0x1D, 0x21, on ? 0x11 : 0x00])
}

// Text size: 0=normal, 1=double height, 2=double width, 3=double both
export function setTextSize(size: 0 | 1 | 2 | 3): Uint8Array {
  const flags = [0x00, 0x10, 0x20, 0x30]
  return new Uint8Array([0x1D, 0x21, flags[size]])
}

// Underline: 0=off, 1=single, 2=double
export function setUnderline(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1B, 0x2D, mode])
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// String to Uint8Array (UTF-8)
function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Concatenate multiple Uint8Arrays
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// Pad string to width
function padStr(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  if (str.length >= width) return str.substring(0, width)
  const pad = width - str.length
  if (align === 'right') {
    return ' '.repeat(pad) + str
  } else if (align === 'center') {
    const left = Math.floor(pad / 2)
    const right = pad - left
    return ' '.repeat(left) + str + ' '.repeat(right)
  }
  return str + ' '.repeat(pad)
}

// ============================================================
// HIGH-LEVEL RECEIPT BUILDERS
// ============================================================

export interface ReceiptItem {
  name: string
  qty: number
  price?: number      // unit price (optional for kitchen orders)
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
  cashier: string
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
  currency?: string
}

// ============================================================
// KITCHEN ORDER RECEIPT (oshpaz/shashlikchi/muzqaymoqchi uchun)
// ============================================================
export function buildKitchenReceipt(data: KitchenOrderData, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []

  // Init
  parts.push(ESC_INIT)

  // Header - restaurant name (if provided)
  if (data.restaurantName) {
    parts.push(setAlign(1))
    parts.push(setBold(true))
    parts.push(setDoubleSize(true))
    parts.push(strToBytes(data.restaurantName + '\n'))
    parts.push(setDoubleSize(false))
    parts.push(setBold(false))
  }

  // Station name (big, bold)
  parts.push(setAlign(1))
  parts.push(setBold(true))
  parts.push(setDoubleSize(true))
  parts.push(strToBytes(data.printerStationName + '\n'))
  parts.push(setDoubleSize(false))
  parts.push(setBold(false))

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Order info
  parts.push(setAlign(0))
  parts.push(setBold(true))
  parts.push(strToBytes(`Buyurtma: ${data.orderNo}\n`))
  parts.push(strToBytes(`Stol: ${data.table}\n`))
  parts.push(strToBytes(`Ofitsiant: ${data.waiter}\n`))
  parts.push(strToBytes(`Vaqt: ${new Date(data.createdAt).toLocaleString('uz-UZ')}\n`))
  parts.push(setBold(false))

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Items
  parts.push(setBold(true))
  parts.push(strToBytes('TAOMLAR:\n'))
  parts.push(setBold(false))

  for (const item of data.items) {
    // Qty x Name
    parts.push(setDoubleSize(true))
    parts.push(strToBytes(`${item.qty} x ${item.name}\n`))
    parts.push(setDoubleSize(false))

    if (item.notes) {
      parts.push(strToBytes(`   ⚠ ${item.notes}\n`))
    }
  }

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Footer
  parts.push(setAlign(1))
  parts.push(strToBytes(`${new Date().toLocaleTimeString('uz-UZ')}\n`))

  // Feed and cut
  parts.push(feedLines(3))
  parts.push(ESC_CUT)

  return concat(...parts)
}

// ============================================================
// PAYMENT RECEIPT (kassa chek)
// ============================================================
export function buildPaymentReceipt(data: PaymentReceiptData, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []
  const currency = data.currency || 'so\'m'

  // Init
  parts.push(ESC_INIT)

  // Header - restaurant name
  parts.push(setAlign(1))
  parts.push(setBold(true))
  parts.push(setDoubleSize(true))
  parts.push(strToBytes(data.restaurantName + '\n'))
  parts.push(setDoubleSize(false))
  parts.push(setBold(false))

  if (data.restaurantPhone) {
    parts.push(strToBytes(`Tel: ${data.restaurantPhone}\n`))
  }

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Invoice info
  parts.push(setAlign(0))
  parts.push(strToBytes(`Chek: ${data.invoiceNo}\n`))
  parts.push(strToBytes(`Stol: ${data.table}\n`))
  parts.push(strToBytes(`Ofitsiant: ${data.waiter}\n`))
  if (data.cashier) {
    parts.push(strToBytes(`Kassir: ${data.cashier}\n`))
  }
  parts.push(strToBytes(`Vaqt: ${new Date(data.createdAt).toLocaleString('uz-UZ')}\n`))

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Items header
  parts.push(strToBytes(padStr('Taom', width - 12) + padStr('Soni', 5, 'right') + padStr('Summa', 7, 'right') + '\n'))
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Items
  for (const item of data.items) {
    const nameLine = item.name.length > width - 12 ? item.name.substring(0, width - 12) : item.name
    const qtyStr = `${item.qty}`
    const priceStr = item.price ? formatMoney(item.price * item.qty) : '-'

    parts.push(strToBytes(
      padStr(nameLine, width - 12) +
      padStr(qtyStr, 5, 'right') +
      padStr(priceStr, 7, 'right') +
      '\n'
    ))
  }

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Totals
  parts.push(setAlign(2))
  parts.push(strToBytes(`Jami: ${formatMoney(data.subtotal)}\n`))
  if (data.discount > 0) {
    parts.push(strToBytes(`Chegirma: -${formatMoney(data.discount)}\n`))
  }
  if (data.serviceCharge > 0) {
    parts.push(strToBytes(`Xizmat: +${formatMoney(data.serviceCharge)}\n`))
  }
  if (data.taxAmount > 0) {
    parts.push(strToBytes(`QQS: +${formatMoney(data.taxAmount)}\n`))
  }

  parts.push(strToBytes('─'.repeat(width) + '\n'))
  parts.push(setBold(true))
  parts.push(setDoubleSize(true))
  parts.push(strToBytes(`TO'LOV: ${formatMoney(data.total)}\n`))
  parts.push(setDoubleSize(false))
  parts.push(setBold(false))

  // Payment method
  const methodLabels: Record<string, string> = {
    cash: '💵 Naqd',
    card: '💳 Karta',
    transfer: '🏦 O\'tkazma',
    split: '🔀 Bo\'lib to\'lash'
  }
  parts.push(strToBytes(`${methodLabels[data.paymentMethod] || data.paymentMethod}\n`))

  // Separator
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  // Footer
  parts.push(setAlign(1))
  parts.push(setDoubleSize(true))
  parts.push(strToBytes('RAHMAT!\n'))
  parts.push(setDoubleSize(false))
  parts.push(strToBytes('Yangi kelishingizni kutamiz\n'))

  // Feed and cut
  parts.push(feedLines(3))
  parts.push(ESC_CUT)

  return concat(...parts)
}

// ============================================================
// TEST PRINT
// ============================================================
export function buildTestReceipt(printerName: string, width: 32 | 48 = 32): Uint8Array {
  const parts: Uint8Array[] = []

  parts.push(ESC_INIT)
  parts.push(setAlign(1))
  parts.push(setBold(true))
  parts.push(setDoubleSize(true))
  parts.push(strToBytes('PRINTER TEST\n'))
  parts.push(setDoubleSize(false))
  parts.push(setBold(false))

  parts.push(strToBytes('─'.repeat(width) + '\n'))
  parts.push(setAlign(0))
  parts.push(strToBytes(`Printer: ${printerName}\n`))
  parts.push(strToBytes(`Vaqt: ${new Date().toLocaleString('uz-UZ')}\n`))
  parts.push(strToBytes('─'.repeat(width) + '\n'))

  parts.push(setAlign(1))
  parts.push(strToBytes('✓ Printer ishlayapti!\n'))
  parts.push(strToBytes('Chek chop etish tayyor\n'))

  parts.push(feedLines(3))
  parts.push(ESC_CUT)

  return concat(...parts)
}

// ============================================================
// UTILITIES
// ============================================================

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' so\'m'
}
