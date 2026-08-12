/**
 * Idempotency helper — for safe retry of mutating operations.
 *
 * Strategy:
 *   1. Caller passes an `Idempotency-Key` header (UUID v4 generated client-side).
 *   2. We attempt the operation.
 *   3. UNIQUE constraint catches duplicate keys → we look up the cached result.
 *   4. We store the cached result in DB (sync_queue or a dedicated cache table).
 *
 * For simplicity, we rely on MySQL UNIQUE constraints on idempotency_key columns
 * in each table (orders, payments, print_jobs, sync_queue) — duplicate inserts
 * throw errno 1062 and we look up the existing record by idempotency_key.
 */
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from './db';
import { RowDataPacket } from 'mysql2';
import { IdempotencyConflictError } from './errors';

export interface IdempotencyRecord {
  id: string;
  entity: string;
  entity_id: string;
  status: 'success' | 'error';
  response_payload: unknown;
  created_at: Date;
}

/**
 * Look up an existing result by idempotency key in `sync_queue` table.
 * If found and status='synced', throw IdempotencyConflictError with the cached payload.
 *
 * NOTE: The general approach is to rely on per-table UNIQUE constraints.
 * This helper is used as a fallback when the operation is multi-step and we
 * want to short-circuit BEFORE the operation is attempted.
 */
export async function checkIdempotencyCache(
  restaurantId: string,
  idempotencyKey: string
): Promise<unknown | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT server_entity_id, payload, status FROM sync_queue
     WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1`,
    [restaurantId, idempotencyKey]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.status === 'synced' || row.status === 'pending') {
    return row.payload;
  }
  return null;
}

export function newIdempotencyKey(): string {
  return uuidv4();
}
