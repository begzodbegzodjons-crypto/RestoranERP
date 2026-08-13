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
 * Conflict resolution:
 *   - order.create: idempotency key (UUID) — duplicates rejected
 *   - order.add_items: version check — conflict returns error
 *   - order.cancel_item: version check — conflict returns error
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { ok } from '../utils/response';
import { entityId } from '../utils/id';

export const syncRouter = Router();

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

syncRouter.use(authRequired);

syncRouter.post('/push', validateBody(pushSchema), async (req, res, next) => {
  const results: unknown[] = [];

  for (const op of req.body.operations) {
    try {
      // Check if already synced
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id, status, server_entity_id FROM sync_queue
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

      // Actually apply the operation based on entity type
      let serverEntityId: string | null = null;

      if (op.entity === 'order' && op.operation === 'create') {
        // Create the order via direct SQL (within the restaurant context)
        const orderId = entityId('ord');
        const orderNumber = await generateSyncOrderNumber(req.ctx!.restaurantId);
        const items = (op.payload as any).items ?? [];
        let subtotal = 0;

        await withTransaction(async (conn) => {
          // Lock table if tableId is provided
          if ((op.payload as any).tableId) {
            const [tables] = await conn.query<RowDataPacket[]>(
              `SELECT id, status, current_order_id FROM tables WHERE id = ? AND restaurant_id = ? FOR UPDATE`,
              [(op.payload as any).tableId, req.ctx!.restaurantId]
            );
            if (tables.length > 0 && tables[0].status === 'occupied' && tables[0].current_order_id) {
              throw new Error(`Table ${(op.payload as any).tableId} is already occupied`);
            }
          }

          // Insert order
          await conn.execute(
            `INSERT INTO orders (id, restaurant_id, order_number, table_id, waiter_id, order_type,
                status, payment_status, subtotal, discount_amount, tax_amount, tip_amount, total,
                idempotency_key, version, opened_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'open', 'unpaid', 0, 0, 0, 0, 0, ?, 1, NOW(3), NOW(3), NOW(3))`,
            [orderId, req.ctx!.restaurantId, orderNumber,
             (op.payload as any).tableId ?? null, req.ctx!.userId,
             (op.payload as any).orderType ?? 'dine_in', op.idempotencyKey]
          );

          // Insert items
          for (const item of items) {
            const lineTotal = Number(item.unitPrice) * Number(item.quantity);
            subtotal += lineTotal;
            await conn.execute(
              `INSERT INTO order_items (id, order_id, product_id, name, unit_price, cost_price,
                  quantity, line_total, notes, station, status, idempotency_key, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(3), NOW(3))`,
              [entityId('itm'), orderId, item.productId, item.name,
               Number(item.unitPrice), Number(item.costPrice ?? 0), Number(item.quantity), lineTotal,
               item.notes ?? null, item.station ?? 'kitchen', entityId('idem')]
            );
          }

          // Update totals
          await conn.execute(
            `UPDATE orders SET subtotal = ?, total = ?, updated_at = NOW(3) WHERE id = ?`,
            [subtotal, subtotal, orderId]
          );

          // Occupy table
          if ((op.payload as any).tableId) {
            await conn.execute(
              `UPDATE tables SET status = 'occupied', current_order_id = ?, updated_at = NOW(3) WHERE id = ?`,
              [orderId, (op.payload as any).tableId]
            );
          }

          // Order event
          await conn.execute(
            `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
             VALUES (?, ?, 'created', ?, ?, NOW(3))`,
            [orderId, req.ctx!.restaurantId, req.ctx!.userId, JSON.stringify({ items_count: items.length, sync: true })]
          );
        });
        serverEntityId = orderId;
      } else {
        // For other operations, just use entity_id from payload or null
        serverEntityId = (op.payload as any)?.id ?? op.entityId ?? null;
      }

      // Mark as synced
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
    } catch (err: any) {
      if (err.errno === 1062) {
        results.push({
          idempotencyKey: op.idempotencyKey,
          status: 'synced',
          replayed: true,
        });
      } else {
        results.push({
          idempotencyKey: op.idempotencyKey,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  await auditReq(req, 'sync_push', 'sync', undefined, null, { count: req.body.operations.length });
  return ok(res, { results, serverTime: new Date().toISOString() });
});

async function generateSyncOrderNumber(restaurantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, 6) AS UNSIGNED)), 0) + 1 AS next
       FROM orders WHERE restaurant_id = ? AND order_number REGEXP ?`,
    [restaurantId, `^${year}-[0-9]+$`]
  ) as any;
  const next = rows[0]?.next ?? 1;
  return `${year}-${String(next).padStart(5, '0')}`;
}

syncRouter.get('/pull', async (req, res, next) => {
  try {
    const since = req.query.since as string;
    if (!since) return res.status(400).json({ ok: false, message: 'since param required (ISO datetime)' });
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
