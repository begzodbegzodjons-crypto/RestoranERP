/**
 * STATIONS routes — kitchen / kebab / bar screen queue + item status updates.
 *
 * GET  /api/station/:station/queue     — pending + cooking items for station
 * PUT  /api/order-items/:id/status     — update item status (state machine)
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

const validTransitions: Record<string, string[]> = {
  pending: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
};

stationsRouter.use(authRequired);

stationsRouter.get('/:station/queue', async (req, res, next) => {
  try {
    const station = stationParamSchema.parse(req.params.station);
    // Permission check: kitchen → station.kitchen.view, etc.
    requirePermission(req.ctx!, `station.${station}.view`);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM v_station_queue WHERE restaurant_id = ? AND station = ? ORDER BY opened_at ASC`,
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
      return { itemId: item.id, status: target };
    });
    return ok(res, result);
  } catch (err) { next(err); }
});
// (cleanup import — requirePerm unused)

