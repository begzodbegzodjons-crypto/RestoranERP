/**
 * STATIONS routes — kitchen / kebab / bar screen queue + item status updates.
 *
 * GET  /api/station/:station/queue     — all items for station grouped by status (4 columns)
 * GET  /api/station/:station/orders    — orders with their station items (for board view)
 * PUT  /api/order-items/:id/status     — update item status (state machine)
 * POST /api/order-items/:id/cancel     — cancel item (with reason)
 *
 * State machine:
 *   pending  → cooking  (kitchen action)
 *   cooking  → ready    (kitchen action)
 *   ready    → served   (waiter/kitchen action)
 *   pending|cooking → cancelled  (with reason)
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, validateBody } from '../middleware';
import { requirePermission } from '../auth/rbac';
import { z } from 'zod';
import { NotFoundError, ValidationError, ConflictError } from '../errors';
import { ok } from '../utils/response';

export const stationsRouter = Router();

const stationParamSchema = z.enum(['kitchen', 'kebab', 'bar']);

const updateItemStatusSchema = z.object({
  status: z.enum(['cooking', 'ready', 'served']),
});

const cancelItemSchema = z.object({
  reason: z.string().min(1).max(200),
});

const validTransitions: Record<string, string[]> = {
  pending: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: [],
};

stationsRouter.use(authRequired);

// Full queue: all items for station (pending + cooking + ready + cancelled-today)
stationsRouter.get('/:station/queue', async (req, res, next) => {
  try {
    const station = stationParamSchema.parse(req.params.station);
    requirePermission(req.ctx!, `station.${station}.view`);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         oi.id            AS order_item_id,
         oi.order_id,
         o.restaurant_id,
         o.order_number,
         o.table_id,
         t.name           AS table_name,
         oi.product_id,
         oi.name          AS product_name,
         oi.quantity,
         oi.unit_price,
         oi.line_total,
         oi.notes,
         oi.station,
         oi.status,
         oi.chef_id,
         c.name           AS chef_name,
         oi.started_at,
         oi.ready_at,
         oi.served_at,
         oi.cancelled_at,
         oi.cancel_reason,
         o.opened_at,
         o.waiter_id,
         w.name           AS waiter_name,
         TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) AS age_seconds,
         CASE
           WHEN oi.status = 'cooking' AND TIMESTAMPDIFF(SECOND, oi.started_at, NOW()) > 600 THEN 'overdue'
           WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 300 THEN 'overdue'
           WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 120 THEN 'warning'
           ELSE 'ok'
         END AS urgency
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users c ON c.id = oi.chef_id
       LEFT JOIN users w ON w.id = o.waiter_id
       WHERE o.restaurant_id = ?
         AND oi.station = ?
         AND oi.status IN ('pending', 'cooking', 'ready')
         AND o.status NOT IN ('cancelled', 'paid')
       ORDER BY
         CASE oi.status
           WHEN 'pending'  THEN 0
           WHEN 'cooking'  THEN 1
           WHEN 'ready'    THEN 2
         END,
         o.opened_at ASC`,
      [req.ctx!.restaurantId, station]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

// Recent cancelled items (last 24h) — for the "Bekor" column
stationsRouter.get('/:station/cancelled', async (req, res, next) => {
  try {
    const station = stationParamSchema.parse(req.params.station);
    requirePermission(req.ctx!, `station.${station}.view`);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         oi.id AS order_item_id, oi.order_id, o.order_number, t.name AS table_name,
         oi.name AS product_name, oi.quantity, oi.notes, oi.station, oi.status,
         oi.cancel_reason, oi.cancelled_at, o.opened_at, o.waiter_id, w.name AS waiter_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users w ON w.id = o.waiter_id
       WHERE o.restaurant_id = ? AND oi.station = ? AND oi.status = 'cancelled'
         AND oi.cancelled_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY oi.cancelled_at DESC
       LIMIT 50`,
      [req.ctx!.restaurantId, station]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

stationsRouter.put('/order-items/:id/status', validateBody(updateItemStatusSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [itemRows] = await conn.query<RowDataPacket[]>(
        `SELECT oi.id, oi.status, oi.order_id, o.restaurant_id, oi.station
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = ? AND o.restaurant_id = ? FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (itemRows.length === 0) throw new NotFoundError('Order item', req.params.id);
      const item = itemRows[0];

      // Permission: kitchen user can only touch kitchen items
      requirePermission(req.ctx!, `station.${item.station}.view`);

      const current = item.status;
      const target = req.body.status;
      if (!validTransitions[current]?.includes(target)) {
        throw new ValidationError(`Invalid status transition: ${current} → ${target}`);
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      updates.push('status = ?'); params.push(target);
      updates.push('updated_at = NOW(3)');
      if (target === 'cooking') { updates.push('started_at = NOW(3)'); updates.push('chef_id = ?'); params.push(req.ctx!.userId); }
      if (target === 'ready') { updates.push('ready_at = NOW(3)'); }
      if (target === 'served') { updates.push('served_at = NOW(3)'); }
      params.push(item.id);

      await conn.execute(
        `UPDATE order_items SET ${updates.join(', ')} WHERE id = ?`,
        params as any[]
      );
      await conn.execute(
        `INSERT INTO order_item_status_history (order_item_id, order_id, restaurant_id, from_status, to_status, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [item.id, item.order_id, item.restaurant_id, current, target, req.ctx!.userId]
      );
      return { itemId: item.id, status: target, previousStatus: current };
    });
    return ok(res, result);
  } catch (err) { next(err); }
});

// Cancel order item (kitchen/kebab can cancel their own station's items)
stationsRouter.post('/order-items/:id/cancel', validateBody(cancelItemSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [itemRows] = await conn.query<RowDataPacket[]>(
        `SELECT oi.id, oi.status, oi.order_id, oi.line_total, o.restaurant_id, oi.station
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = ? AND o.restaurant_id = ? FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (itemRows.length === 0) throw new NotFoundError('Order item', req.params.id);
      const item = itemRows[0];
      requirePermission(req.ctx!, `station.${item.station}.view`);

      const current = item.status;
      if (!validTransitions[current]?.includes('cancelled')) {
        throw new ValidationError(`Cannot cancel item in status: ${current}`);
      }

      await conn.execute(
        `UPDATE order_items
           SET status = 'cancelled', cancelled_at = NOW(3), cancel_reason = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [req.body.reason, item.id]
      );
      // Reduce order totals
      await conn.execute(
        `UPDATE orders SET subtotal = subtotal - ?, total = total - ?, version = version + 1, updated_at = NOW(3) WHERE id = ?`,
        [item.line_total, item.line_total, item.order_id]
      );
      // History
      await conn.execute(
        `INSERT INTO order_item_status_history (order_item_id, order_id, restaurant_id, from_status, to_status, changed_by, note, created_at)
         VALUES (?, ?, ?, ?, 'cancelled', ?, ?, NOW(3))`,
        [item.id, item.order_id, item.restaurant_id, current, req.ctx!.userId, req.body.reason]
      );
      return { itemId: item.id, status: 'cancelled', previousStatus: current };
    });
    return ok(res, result);
  } catch (err) { next(err); }
});

