/**
 * ID generators — cuid-style (28-char) for entity IDs, UUID for sync/device IDs.
 */
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a 28-char cuid-style ID (compatible with our CHAR(28) primary keys).
 * Format: prefix + '_' + 22 hex chars
 * For ids without prefix (raw 28 chars), use generateRawId().
 */
export function entityId(prefix: string = 'ent'): string {
  if (prefix.length > 5) prefix = prefix.slice(0, 5);
  const hex = crypto.randomBytes(14).toString('hex'); // 28 hex chars
  const id = `${prefix}_${hex}`;
  return id.slice(0, 28);
}

/**
 * Generate a raw 28-char ID without prefix.
 */
export function generateRawId(): string {
  return crypto.randomBytes(14).toString('hex').slice(0, 28);
}

/** UUID v4 — for sync_queue idempotency keys, devices, refresh tokens. */
export function uuid(): string { return uuidv4(); }

/**
 * Generate sequential order number: YYYY-NNNNN
 * Must be called inside a transaction with restaurant row FOR UPDATE.
 */
export async function generateOrderNumber(
  txOrPool: { query: (sql: string, p?: unknown[]) => Promise<[unknown[], unknown]> },
  restaurantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const [rows] = await txOrPool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, 6) AS UNSIGNED)), 0) + 1 AS next
       FROM orders
      WHERE restaurant_id = ?
        AND order_number REGEXP ?`,
    [restaurantId, `^${year}-[0-9]+$`]
  ) as [{ next: number }[], unknown];
  const next = rows[0]?.next ?? 1;
  return `${year}-${String(next).padStart(5, '0')}`;
}
