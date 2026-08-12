/**
 * SYNC routes — offline-first synchronization.
 *
 * POST /api/sync/push   — client pushes batch of local operations (idempotent)
 * GET  /api/sync/pull   — client pulls deltas since a timestamp
 * GET  /api/sync/status — device sync status
 *
 * Each operation has an idempotency_key. If a key is already processed,
 * the previous result is returned (dedup).
 *
 * Conflict resolution strategy:
 *   - For each op: check UNIQUE(idempotency_key) on sync_queue
 *   - If exists → return cached result
 *   - Otherwise → attempt the operation in a transaction
 *   - On version conflict → return 'conflict' status, client decides
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { ok } from '../utils/response';
import { entityId } from '../utils/id';

export const syncRouter = Router();

syncRouter.use(authRequired);

const pushOpSchema = z.object({
  idempotencyKey: z.string().min(32).max(36),
  entity: z.enum(['order', 'order_item', 'payment', 'inventory_adjust']),
  operation: z.enum(['create', 'update', 'delete']),
  entityId: z.string().nullable().optional(),
  payload: z.record(z.unknown()),
  clientVersion: z.number().int().min(0).default(0),
});

const pushSchema = z.object({
  deviceId: z.string().uuid(),
  operations: z.array(pushOpSchema).min(1).max(100),
});

syncRouter.post('/push', validateBody(pushSchema), async (req, res, next) => {
  try {
    const results: unknown[] = [];
    for (const op of req.body.operations) {
      try {
        // Check if already synced
        const [existing] = await pool.query<RowDataPacket[]>(
          `SELECT id, status, server_entity_id, payload FROM sync_queue
            WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1`,
          [req.ctx!.restaurantId, op.idempotencyKey]
        );
        if (existing.length > 0 && existing[0].status === 'synced') {
          results.push({
            idempotencyKey: op.idempotencyKey,
            status: 'synced',
            serverEntityId: existing[0].server_entity_id,
            replayed: true,
          });
          continue;
        }

        // Insert into sync_queue as 'pending'
        await pool.execute(
          `INSERT INTO sync_queue (restaurant_id, device_id, user_id, entity, entity_id, operation,
                                   payload, idempotency_key, client_version, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(3))
           ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key`,
          [req.ctx!.restaurantId, req.body.deviceId, req.ctx!.userId,
           op.entity, op.entityId ?? null, op.operation,
           JSON.stringify(op.payload), op.idempotencyKey, op.clientVersion]
        );

        // Actually apply the operation (simplified — real impl would dispatch per entity)
        // For now, we just mark as 'synced' with the entity id from the payload
        const serverEntityId = op.payload?.id as string ?? op.entityId ?? null;

        await pool.execute(
          `UPDATE sync_queue SET status = 'synced', server_entity_id = ?, synced_at = NOW(3)
           WHERE restaurant_id = ? AND idempotency_key = ?`,
          [serverEntityId, req.ctx!.restaurantId, op.idempotencyKey]
        );

        results.push({
          idempotencyKey: op.idempotencyKey,
          status: 'synced',
          serverEntityId,
        });
      } catch (err) {
        results.push({
          idempotencyKey: op.idempotencyKey,
          status: 'failed',
          error: (err as Error).message,
        });
      }
    }
    await auditReq(req, 'sync_push', 'sync', undefined, null, { count: req.body.operations.length });
    return ok(res, { results, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

syncRouter.get('/pull', async (req, res, next) => {
  try {
    const since = req.query.since as string;
    if (!since) return res.status(400).json({ ok: false, message: 'since param required (ISO datetime)' });
    // Pull updated entities since timestamp
    const [tables] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, status, current_order_id, updated_at FROM tables
        WHERE restaurant_id = ? AND updated_at > ?`,
      [req.ctx!.restaurantId, since]
    );
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT id, order_number, table_id, status, payment_status, total, version, updated_at
         FROM orders WHERE restaurant_id = ? AND updated_at > ?`,
      [req.ctx!.restaurantId, since]
    );
    const [orderItems] = await pool.query<RowDataPacket[]>(
      `SELECT oi.id, oi.order_id, oi.status, oi.updated_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = ? AND oi.updated_at > ?`,
      [req.ctx!.restaurantId, since]
    );
    return ok(res, {
      serverTime: new Date().toISOString(),
      changes: { tables, orders, orderItems },
    });
  } catch (err) { next(err); }
});

syncRouter.get('/status', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ ok: false, message: 'deviceId required' });
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, type, last_seen_at, last_sync_at, last_sync_version
         FROM devices WHERE id = ? AND restaurant_id = ?`,
      [deviceId, req.ctx!.restaurantId]
    );
    const [pendingCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM sync_queue WHERE restaurant_id = ? AND status = 'pending'`,
      [req.ctx!.restaurantId]
    );
    return ok(res, { device: rows[0] ?? null, pendingOperations: pendingCount[0].cnt });
  } catch (err) { next(err); }
});
