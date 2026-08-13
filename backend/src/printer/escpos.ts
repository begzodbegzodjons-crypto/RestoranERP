/**
 * ESC/POS encoder — builds raw ESC/POS byte commands for thermal printers.
 *
 * Supports:
 *   - Kitchen/kebab/bar order slips (with table, waiter, items, notes)
 *   - Cashier receipt (full payment breakdown)
 *   - Cancel slip
 *   - Z-report
 *   - Test print
 *
 * All output is a Buffer of raw bytes (ESC/POS commands).
 * The print server writes these bytes directly to the printer (USB or LAN).
 */

// ESC/POS command constants
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

function init(): Buffer {
  return Buffer.from([ESC, 0x40]);
}

function feed(n: number): Buffer {
  return Buffer.from([ESC, 0x64, n]);
}

function align(a: 0 | 1 | 2): Buffer {
  return Buffer.from([ESC, 0x61, a]);
}

function bold(on: boolean): Buffer {
  return Buffer.from([ESC, 0x45, on ? 1 : 0]);
}

function doubleSize(on: boolean): Buffer {
  return Buffer.from([GS, 0x21, on ? 0x30 : 0x00]);
}

function text(s: string): Buffer {
  return Buffer.from(s, 'utf8');
}

function br(): Buffer {
  return Buffer.from([LF]);
}

function separator(width: number): Buffer {
  return Buffer.from('-'.repeat(width) + '\n', 'utf8');
}

function cut(): Buffer {
  return Buffer.from([GS, 0x56, 0x01]);
}

function beep(): Buffer {
  return Buffer.from([ESC, 0x42, 0x03]);
}

function padRight(s: string, len: number): string {
  if (s.length >= len) return s.substring(0, len);
  return s + ' '.repeat(len - s.length);
}

function padLeft(s: string, len: number): string {
  if (s.length >= len) return s.substring(0, len);
  return ' '.repeat(len - s.length) + s;
}

function formatMoney(n: number | string): string {
  return Number(n).toLocaleString('uz-UZ');
}

export interface OrderSlipData {
  orderNumber: string;
  tableName: string | null;
  waiterName: string | null;
  openedAt: string;
  items: Array<{
    name: string;
    quantity: number | string;
    notes?: string | null;
  }>;
  isAddition?: boolean;
}

export function encodeOrderSlip(data: OrderSlipData, paperWidth: 58 | 80 = 58): Buffer {
  const W = paperWidth === 80 ? 42 : 32;
  const parts: Buffer[] = [];

  parts.push(init());
  parts.push(beep());

  parts.push(align(1));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text(data.isAddition ? "QO'SHIMCHA" : 'BUYURTMA'));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());

  parts.push(align(0));
  parts.push(bold(true));
  parts.push(text(`#${data.orderNumber}`));
  parts.push(bold(false));
  parts.push(br());

  if (data.tableName) {
    parts.push(text(`Stol: ${data.tableName}`));
    parts.push(br());
  }
  if (data.waiterName) {
    parts.push(text(`Ofitsiant: ${data.waiterName}`));
    parts.push(br());
  }
  parts.push(text(`Vaqt: ${new Date(data.openedAt).toLocaleString('uz-UZ')}`));
  parts.push(br());

  parts.push(separator(W));

  for (const item of data.items) {
    parts.push(bold(true));
    parts.push(text(item.name));
    parts.push(br());
    parts.push(bold(false));
    parts.push(text(`  x${Number(item.quantity)}`));
    parts.push(br());
    if (item.notes) {
      parts.push(text(`  * ${item.notes}`));
      parts.push(br());
    }
  }

  parts.push(separator(W));
  parts.push(feed(2));
  parts.push(cut());

  return Buffer.concat(parts);
}

export interface ReceiptData {
  restaurantName: string;
  restaurantPhone?: string;
  orderNumber: string;
  tableName?: string | null;
  waiterName?: string | null;
  cashierName?: string | null;
  paidAt: string;
  items: Array<{
    name: string;
    quantity: number | string;
    unitPrice: number | string;
    lineTotal: number | string;
  }>;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  tipAmount: number | string;
  totalPaid: number | string;
  paymentMethod: string;
  cashAmount: number | string;
  cardAmount: number | string;
  clickAmount: number | string;
  paymeAmount: number | string;
  changeAmount: number | string;
}

export function encodeReceipt(data: ReceiptData, paperWidth: 58 | 80 = 80): Buffer {
  const W = paperWidth === 80 ? 42 : 32;
  const parts: Buffer[] = [];

  parts.push(init());

  parts.push(align(1));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text(data.restaurantName));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());

  if (data.restaurantPhone) {
    parts.push(text(`Tel: ${data.restaurantPhone}`));
    parts.push(br());
  }
  parts.push(text(new Date(data.paidAt).toLocaleString('uz-UZ')));
  parts.push(br());
  parts.push(separator(W));

  parts.push(align(0));
  parts.push(text(`Order: #${data.orderNumber}`));
  parts.push(br());
  if (data.tableName) {
    parts.push(text(`Stol: ${data.tableName}`));
    parts.push(br());
  }
  if (data.waiterName) {
    parts.push(text(`Ofitsiant: ${data.waiterName}`));
    parts.push(br());
  }
  if (data.cashierName) {
    parts.push(text(`Kassir: ${data.cashierName}`));
    parts.push(br());
  }
  parts.push(separator(W));

  for (const item of data.items) {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const total = Number(item.lineTotal);
    parts.push(text(item.name));
    parts.push(br());
    parts.push(text(`  x${qty} @ ${formatMoney(price)} = ${formatMoney(total)}`));
    parts.push(br());
  }
  parts.push(separator(W));

  parts.push(text(`${padRight('Subtotal', W - 12)}${padLeft(formatMoney(Number(data.subtotal)), 12)}`));
  parts.push(br());
  if (Number(data.discountAmount) > 0) {
    parts.push(text(`${padRight('Chegirma', W - 12)}${padLeft('-' + formatMoney(Number(data.discountAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.taxAmount) > 0) {
    parts.push(text(`${padRight('Soliq', W - 12)}${padLeft(formatMoney(Number(data.taxAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.tipAmount) > 0) {
    parts.push(text(`${padRight('Choy puli', W - 12)}${padLeft(formatMoney(Number(data.tipAmount)), 12)}`));
    parts.push(br());
  }

  parts.push(separator(W));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text(`${padRight('JAMI', W - 14)}${padLeft(formatMoney(Number(data.totalPaid)) + " so'm", 14)}`));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());
  parts.push(separator(W));

  if (Number(data.cashAmount) > 0) {
    parts.push(text(`${padRight('Naqd', W - 12)}${padLeft(formatMoney(Number(data.cashAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.cardAmount) > 0) {
    parts.push(text(`${padRight('Karta', W - 12)}${padLeft(formatMoney(Number(data.cardAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.clickAmount) > 0) {
    parts.push(text(`${padRight('Click', W - 12)}${padLeft(formatMoney(Number(data.clickAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.paymeAmount) > 0) {
    parts.push(text(`${padRight('Payme', W - 12)}${padLeft(formatMoney(Number(data.paymeAmount)), 12)}`));
    parts.push(br());
  }
  if (Number(data.changeAmount) > 0) {
    parts.push(text(`${padRight('Qaytim', W - 12)}${padLeft(formatMoney(Number(data.changeAmount)), 12)}`));
    parts.push(br());
  }

  parts.push(separator(W));
  parts.push(align(1));
  parts.push(text('Rahmat! Keling yana!'));
  parts.push(br());
  parts.push(feed(3));
  parts.push(cut());

  return Buffer.concat(parts);
}

export function encodeCancelSlip(data: {
  orderNumber: string;
  tableName: string | null;
  itemName: string;
  quantity: number | string;
  reason: string;
  cancelledAt: string;
  cancelledBy: string;
}, paperWidth: 58 | 80 = 58): Buffer {
  const W = paperWidth === 80 ? 42 : 32;
  const parts: Buffer[] = [];

  parts.push(init());
  parts.push(beep());

  parts.push(align(1));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text('BEKOR QILINDI'));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());

  parts.push(align(0));
  parts.push(text(`Order: #${data.orderNumber}`));
  parts.push(br());
  if (data.tableName) {
    parts.push(text(`Stol: ${data.tableName}`));
    parts.push(br());
  }
  parts.push(separator(W));
  parts.push(bold(true));
  parts.push(text(data.itemName));
  parts.push(br());
  parts.push(bold(false));
  parts.push(text(`  x${Number(data.quantity)}`));
  parts.push(br());
  parts.push(separator(W));
  parts.push(text(`Sabab: ${data.reason}`));
  parts.push(br());
  parts.push(text(`Bekor qildi: ${data.cancelledBy}`));
  parts.push(br());
  parts.push(text(`Vaqt: ${new Date(data.cancelledAt).toLocaleString('uz-UZ')}`));
  parts.push(br());
  parts.push(feed(2));
  parts.push(cut());

  return Buffer.concat(parts);
}

export function encodeZReport(data: {
  restaurantName: string;
  periodFrom: string;
  periodTo: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  clickSales: number;
  paymeSales: number;
  voids: number;
  paymentsCount: number;
}, paperWidth: 58 | 80 = 80): Buffer {
  const W = paperWidth === 80 ? 42 : 32;
  const parts: Buffer[] = [];

  parts.push(init());

  parts.push(align(1));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text('Z-OTCHET'));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());
  parts.push(text(data.restaurantName));
  parts.push(br());
  parts.push(separator(W));

  parts.push(align(0));
  parts.push(text(`Davr: ${new Date(data.periodFrom).toLocaleString('uz-UZ')}`));
  parts.push(br());
  parts.push(text(`       ${new Date(data.periodTo).toLocaleString('uz-UZ')}`));
  parts.push(br());
  parts.push(separator(W));

  parts.push(bold(true));
  parts.push(text(`${padRight('Jami savdo', W - 12)}${padLeft(formatMoney(data.totalSales), 12)}`));
  parts.push(bold(false));
  parts.push(br());
  parts.push(text(`${padRight('Naqd', W - 12)}${padLeft(formatMoney(data.cashSales), 12)}`));
  parts.push(br());
  parts.push(text(`${padRight('Karta', W - 12)}${padLeft(formatMoney(data.cardSales), 12)}`));
  parts.push(br());
  parts.push(text(`${padRight('Click', W - 12)}${padLeft(formatMoney(data.clickSales), 12)}`));
  parts.push(br());
  parts.push(text(`${padRight('Payme', W - 12)}${padLeft(formatMoney(data.paymeSales), 12)}`));
  parts.push(br());
  parts.push(separator(W));
  parts.push(text(`${padRight("To'lovlar soni", W - 12)}${padLeft(String(data.paymentsCount), 12)}`));
  parts.push(br());
  parts.push(text(`${padRight('Bekor qilingan', W - 12)}${padLeft(String(data.voids), 12)}`));
  parts.push(br());

  parts.push(separator(W));
  parts.push(align(1));
  parts.push(text('--- OTCHET YOPILDI ---'));
  parts.push(br());
  parts.push(feed(3));
  parts.push(cut());

  return Buffer.concat(parts);
}

export function encodeTestPrint(printerName: string, station: string): Buffer {
  const parts: Buffer[] = [];

  parts.push(init());
  parts.push(beep());

  parts.push(align(1));
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text('TEST PRINT'));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(br());
  parts.push(text(`Printer: ${printerName}`));
  parts.push(br());
  parts.push(text(`Station: ${station}`));
  parts.push(br());
  parts.push(text(`Vaqt: ${new Date().toLocaleString('uz-UZ')}`));
  parts.push(br());
  parts.push(feed(2));
  parts.push(text('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
  parts.push(br());
  parts.push(text('0123456789'));
  parts.push(br());
  parts.push(text("Test muvaffaqiyatli o'tdi!"));
  parts.push(br());
  parts.push(feed(3));
  parts.push(cut());

  return Buffer.concat(parts);
}
