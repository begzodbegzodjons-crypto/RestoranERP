/**
 * ORDERS routes — create, add items, cancel, list, get.
 *
 * POST   /api/orders                       — create order WITH items (atomic)
 * GET    /api/orders                       — list (with filters)
 * GET    /api/orders/:id                   — get full order detail
 * POST   /api/orders/:id/items             — add item(s) to existing order (atomic)
 * PUT    /api/orders/:id/items/:itemId     — modify item (quantity/notes)
 * POST   /api/orders/:id/items/:itemId/cancel — cancel single item (with reason)
 * POST   /api/orders/:id/cancel            — cancel entire order (with reason)
 * POST   /api/orders/:id/send              — route pending items to stations + create print jobs
 *
 * CONCURRENCY:
 *   - create uses INSERT IGNORE on UNIQUE(restaurant_id, idempotency_key)
 *   - add_items bumps version (optimistic)
 *   - cancel uses SELECT FOR UPDATE
 */
import { Router } from 'express';
import { pool, RowDataPacket, ResultSetHeader, withTransaction } from '../db';
import { authRequired, requirePerm, validateBody, validateQuery, auditReq } from '../middleware';
import { z } from 'zod';
import {
  createOrderSchema, addOrderItemSchema, cancelOrderItemSchema,
  cancelOrderSchema, listOrdersQuerySchema,
} from '../validation/order';
import { NotFoundError, ConflictError, AppError, IdempotencyConflictError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId, generateOrderNumber } from '../utils/id';
import { v4 as uuidv4 } from 'uuid';
import { writeAudit } from '../audit';

void AppError; void IdempotencyConflictError; void writeAudit;

export const ordersRouter = Router();

ordersRouter.use(authRequired);

// ============================================================
// CREATE ORDER (atomic, idempotent)
// ============================================================
ordersRouter.post('/', requirePerm('order.create'), validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const input = req.body;
    const restaurantId = req.ctx!.restaurantId;
    const waiterId = input.waiterId ?? req.ctx!.userId;
    const orderId = entityId('ord');

    const result = await withTransaction(async (conn) => {
      // 1. Lock the table row (if tableId provided) — prevents two waiters grabbing same table
      let tableRow: RowDataPacket | null = null;
      if (input.tableId) {
        const [tables] = await conn.query<RowDataPacket[]>(
          `SELECT id, status, current_order_id FROM tables
            WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL FOR UPDATE`,
          [input.tableId, restaurantId]
        );
        if (tables.length === 0) throw new NotFoundError('Table', input.tableId);
        tableRow = tables[0];
        if (tableRow.status === 'occupied' && tableRow.current_order_id) {
          throw new ConflictError(`Table ${input.tableId} is already occupied`);
        }
      }

      // 2. Generate order number (must be unique per restaurant)
      const orderNumber = await generateOrderNumber(conn, restaurantId);

      // 3. Insert order — INSERT to leverage UNIQUE(restaurant_id, idempotency_key)
      //    If duplicate, errno 1062 → we look up existing order and return it (idempotent replay)
      let inserted = true;
      try {
        await conn.execute(
          `INSERT INTO orders
             (id, restaurant_id, branch_id, order_number, table_id, waiter_id, order_type,
              status, payment_status, subtotal, discount_amount, tax_amount, tip_amount, total,
              customer_name, customer_phone, notes, idempotency_key, version,
              opened_at, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, 'open', 'unpaid', ?, 0, 0, 0, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3), NOW(3))`,
          [orderId, restaurantId, orderNumber,
           input.tableId ?? null, waiterId, input.orderType,
           0, // subtotal placeholder
           0, // total placeholder
           input.customerName ?? null, input.customerPhone ?? null, input.notes ?? null,
           input.idempotencyKey]
        );
      } catch (err: any) {
        if (err.errno === 1062) {
          // Idempotency replay — find existing order
          const [existing] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM orders WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1`,
            [restaurantId, input.idempotencyKey]
          );
          if (existing.length > 0) {
            return { replayed: true, orderId: existing[0].id };
          }
        }
        throw err;
      }

      // 4. Insert all order_items + compute totals
      let subtotal = 0;
      const itemsToInsert = input.items;
      for (const item of itemsToInsert) {
        const itemId = entityId('itm');
        const lineTotal = item.unitPrice * item.quantity;
        subtotal += lineTotal;
        await conn.execute(
          `INSERT INTO order_items
             (id, order_id, product_id, variant_id, name, unit_price, cost_price,
              quantity, line_total, notes, station, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(3), NOW(3))`,
          [itemId, orderId, item.productId, item.variantId ?? null, item.name,
           item.unitPrice, item.costPrice, item.quantity, lineTotal,
           item.notes ?? null, item.station, uuidv4()]
        );
      }

      // 5. Update order totals
      await conn.execute(
        `UPDATE orders SET subtotal = ?, total = ?, updated_at = NOW(3) WHERE id = ?`,
        [subtotal, subtotal, orderId]
      );

      // 6. Mark table as occupied
      if (input.tableId && tableRow) {
        await conn.execute(
          `UPDATE tables SET status = 'occupied', current_order_id = ?, updated_at = NOW(3) WHERE id = ?`,
          [orderId, input.tableId]
        );
      }

      // 7. Insert order event
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'created', ?, ?, NOW(3))`,
        [orderId, restaurantId, waiterId, JSON.stringify({ items_count: itemsToInsert.length, table_id: input.tableId ?? null })]
      );

      return { replayed: false, orderId };
    });

    await auditReq(req, 'create', 'order', result.orderId, null, { items: input.items.length });

    // Fetch the order with items for response
    const [orderRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.*, t.name AS table_name, w.name AS waiter_name
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         LEFT JOIN users w ON w.id = o.waiter_id
        WHERE o.id = ?`,
      [result.orderId]
    );
    const [itemRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
      [result.orderId]
    );

    if (result.replayed) {
      return res.status(200).json({
        ok: true, code: 'IDEMPOTENT_REPLAY', idempotent: true,
        data: { ...orderRows[0], items: itemRows }
      });
    }
    return created(res, { ...orderRows[0], items: itemRows });
  } catch (err) { next(err); }
});

// ============================================================
// LIST ORDERS
// ============================================================
ordersRouter.get('/', requirePerm('order.read'), validateQuery(listOrdersQuerySchema), async (req, res, next) => {
  try {
    const q = req.query as any;
    const where: string[] = ['o.restaurant_id = ?', 'o.deleted_at IS NULL'];
    const params: unknown[] = [req.ctx!.restaurantId];
    if (q.status) { where.push('o.status = ?'); params.push(q.status); }
    if (q.paymentStatus) { where.push('o.payment_status = ?'); params.push(q.paymentStatus); }
    if (q.tableId) { where.push('o.table_id = ?'); params.push(q.tableId); }
    if (q.waiterId) { where.push('o.waiter_id = ?'); params.push(q.waiterId); }

    const limit = q.limit ?? 50;
    const offset = ((q.page ?? 1) - 1) * limit;
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.order_number, o.table_id, t.name AS table_name,
              o.waiter_id, w.name AS waiter_name,
              o.order_type, o.status, o.payment_status,
              o.subtotal, o.discount_amount, o.tax_amount, o.tip_amount, o.total,
              o.opened_at, o.closed_at, o.created_at, o.version
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         LEFT JOIN users w ON w.id = o.waiter_id
        WHERE ${where.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?`,
      params
    );
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders o WHERE ${where.join(' AND ')}`,
      params.slice(0, -2)
    );
    return ok(res, { items: rows, total: countRows[0].total, page: q.page, limit });
  } catch (err) { next(err); }
});

// ============================================================
// GET ORDER DETAIL
// ============================================================
ordersRouter.get('/:id', requirePerm('order.read'), async (req, res, next) => {
  try {
    const [orderRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.*, t.name AS table_name, w.name AS waiter_name, c.name AS cashier_name
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         LEFT JOIN users w ON w.id = o.waiter_id
         LEFT JOIN users c ON c.id = o.cashier_id
        WHERE o.id = ? AND o.restaurant_id = ? AND o.deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (orderRows.length === 0) throw new NotFoundError('Order', req.params.id);
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT oi.*, p.name AS product_name, c.name AS chef_name
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN users c ON c.id = oi.chef_id
        WHERE oi.order_id = ?
        ORDER BY oi.created_at ASC`,
      [req.params.id]
    );
    const [events] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC`,
      [req.params.id]
    );
    return ok(res, { ...orderRows[0], items, events });
  } catch (err) { next(err); }
});

// ============================================================
// ADD ITEMS TO EXISTING ORDER (atomic, version bump)
// ============================================================
const addItemsSchema = z.object({
  items: z.array(addOrderItemSchema).min(1).max(200),
});

ordersRouter.post('/:id/items', requirePerm('order.update'), validateBody(addItemsSchema), async (req, res, next) => {
  const items = req.body.items;
  try {
    const result = await withTransaction(async (conn) => {
      // Lock order row
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, payment_status, version, table_id FROM orders
          WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (orderRows.length === 0) throw new NotFoundError('Order', req.params.id);
      const order = orderRows[0];
      if (order.status === 'paid') throw new ConflictError('Cannot add items to a paid order');
      if (order.status === 'cancelled') throw new ConflictError('Cannot add items to a cancelled order');

      const insertedItems: unknown[] = [];
      let subtotalDelta = 0;
      for (const item of items) {
        const itemId = entityId('itm');
        const lineTotal = item.unitPrice * item.quantity;
        subtotalDelta += lineTotal;
        await conn.execute(
          `INSERT INTO order_items
             (id, order_id, product_id, variant_id, name, unit_price, cost_price,
              quantity, line_total, notes, station, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(3), NOW(3))`,
          [itemId, order.id, item.productId, item.variantId ?? null, item.name,
           item.unitPrice, item.costPrice, item.quantity, lineTotal,
           item.notes ?? null, item.station, uuidv4()]
        );
        insertedItems.push({ id: itemId, lineTotal, ...item });
      }
      // Bump version + update totals
      await conn.execute(
        `UPDATE orders SET subtotal = subtotal + ?, total = total + ?, version = version + 1, updated_at = NOW(3) WHERE id = ?`,
        [subtotalDelta, subtotalDelta, order.id]
      );
      // Order event
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'items_added', ?, ?, NOW(3))`,
        [order.id, req.ctx!.restaurantId, req.ctx!.userId, JSON.stringify({ count: items.length })]
      );
      return { orderVersion: order.version + 1, insertedItems };
    });
    await auditReq(req, 'add_items', 'order', req.params.id, null, { count: items.length });
    return created(res, result);
  } catch (err) { next(err); }
});

// ============================================================
// CANCEL ORDER ITEM
// ============================================================
ordersRouter.post('/:id/items/:itemId/cancel', requirePerm('order.item.cancel'), validateBody(cancelOrderItemSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [itemRows] = await conn.query<RowDataPacket[]>(
        `SELECT oi.id, oi.order_id, oi.status, oi.line_total, oi.quantity, o.status AS order_status, o.restaurant_id
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = ? AND oi.order_id = ? AND o.restaurant_id = ?
          FOR UPDATE`,
        [req.params.itemId, req.params.id, req.ctx!.restaurantId]
      );
      if (itemRows.length === 0) throw new NotFoundError('Order item', req.params.itemId);
      const item = itemRows[0];
      if (item.status === 'cancelled') throw new ConflictError('Item already cancelled');
      if (item.order_status === 'paid') throw new ConflictError('Cannot cancel item of paid order (use refund flow)');

      await conn.execute(
        `UPDATE order_items SET status = 'cancelled', cancelled_at = NOW(3), cancel_reason = ?, updated_at = NOW(3) WHERE id = ?`,
        [req.body.reason, item.id]
      );
      // Reduce order totals
      await conn.execute(
        `UPDATE orders SET subtotal = subtotal - ?, total = total - ?, version = version + 1, updated_at = NOW(3) WHERE id = ?`,
        [item.line_total, item.line_total, item.order_id]
      );
      // Audit history
      await conn.execute(
        `INSERT INTO order_item_status_history (order_item_id, order_id, restaurant_id, from_status, to_status, changed_by, note, created_at)
         VALUES (?, ?, ?, ?, 'cancelled', ?, ?, NOW(3))`,
        [item.id, item.order_id, req.ctx!.restaurantId, item.status, req.ctx!.userId, req.body.reason]
      );
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'item_cancelled', ?, ?, NOW(3))`,
        [item.order_id, req.ctx!.restaurantId, req.ctx!.userId,
         JSON.stringify({ itemId: item.id, reason: req.body.reason })]
      );
      return { itemId: item.id, orderId: item.order_id };
    });
    await auditReq(req, 'cancel_item', 'order_item', req.params.itemId, null, { reason: req.body.reason });
    return ok(res, result);
  } catch (err) { next(err); }
});

// ============================================================
// CANCEL ENTIRE ORDER
// ============================================================
ordersRouter.post('/:id/cancel', requirePerm('order.cancel'), validateBody(cancelOrderSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, payment_status, table_id, version FROM orders
          WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (orderRows.length === 0) throw new NotFoundError('Order', req.params.id);
      const order = orderRows[0];
      if (order.status === 'paid') throw new ConflictError('Cannot cancel paid order (use refund)');
      if (order.status === 'cancelled') throw new ConflictError('Order already cancelled');

      await conn.execute(
        `UPDATE orders SET status = 'cancelled', version = version + 1, closed_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [order.id]
      );
      // Cancel all pending items
      await conn.execute(
        `UPDATE order_items SET status = 'cancelled', cancelled_at = NOW(3), cancel_reason = ? WHERE order_id = ? AND status IN ('pending','cooking')`,
        [req.body.reason, order.id]
      );
      // Free table
      if (order.table_id) {
        await conn.execute(
          `UPDATE tables SET status = 'free', current_order_id = NULL, updated_at = NOW(3) WHERE id = ?`,
          [order.table_id]
        );
      }
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'cancelled', ?, ?, NOW(3))`,
        [order.id, req.ctx!.restaurantId, req.ctx!.userId, JSON.stringify({ reason: req.body.reason })]
      );
      return { orderId: order.id };
    });
    await auditReq(req, 'cancel', 'order', req.params.id, null, { reason: req.body.reason });
    return ok(res, result);
  } catch (err) { next(err); }
});

// ============================================================
// SEND TO STATIONS (kitchen / kebab / bar)
// Creates print jobs grouped by station.
// ============================================================
ordersRouter.post('/:id/send', requirePerm('order.update'), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, restaurant_id FROM orders WHERE id = ? AND restaurant_id = ? FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (orderRows.length === 0) throw new NotFoundError('Order', req.params.id);

      // Group pending items by station
      const [items] = await conn.query<RowDataPacket[]>(
        `SELECT id, station FROM order_items WHERE order_id = ? AND status = 'pending'`,
        [req.params.id]
      );
      if (items.length === 0) throw new ConflictError('No pending items to send');

      const byStation = new Map<string, string[]>();
      for (const it of items) {
        if (!byStation.has(it.station)) byStation.set(it.station, []);
        byStation.get(it.station)!.push(it.id);
      }

      // Find printer per station
      const stationPrintJobs: { station: string; jobId: string }[] = [];
      for (const [station, itemIds] of byStation) {
        const [printerRows] = await conn.query<RowDataPacket[]>(
          `SELECT p.id FROM printers p
            JOIN printer_routes pr ON pr.printer_id = p.id
           WHERE p.restaurant_id = ? AND p.station = ? AND p.is_active = 1
             AND pr.source_type = 'station' AND pr.station = ? AND pr.event = 'order' AND pr.is_active = 1
           ORDER BY pr.priority ASC LIMIT 1`,
          [req.ctx!.restaurantId, station, station]
        );
        if (printerRows.length === 0) continue;
        const printerId = printerRows[0].id;
        const jobId = entityId('pj');
        await conn.execute(
          `INSERT INTO print_jobs (id, restaurant_id, printer_id, order_id, payment_id, type, payload, status, idempotency_key, queued_at)
           VALUES (?, ?, ?, ?, NULL, 'order', X'1B40', 'pending', ?, NOW(3))`,
          [jobId, req.ctx!.restaurantId, printerId, req.params.id, uuidv4()]
        );
        stationPrintJobs.push({ station, jobId });
      }

      // Mark items as 'cooking' (sent)
      await conn.execute(
        `UPDATE order_items SET status = 'cooking', started_at = NOW(3), updated_at = NOW(3)
         WHERE order_id = ? AND status = 'pending'`,
        [req.params.id]
      );
      // Update order status
      await conn.execute(
        `UPDATE orders SET status = 'cooking', version = version + 1, updated_at = NOW(3) WHERE id = ?`,
        [req.params.id]
      );

      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'sent_to_kitchen', ?, ?, NOW(3))`,
        [req.params.id, req.ctx!.restaurantId, req.ctx!.userId,
         JSON.stringify({ stations: Array.from(byStation.keys()), items_count: items.length })]
      );

      return { stations: stationPrintJobs, itemCount: items.length };
    });
    await auditReq(req, 'send_to_kitchen', 'order', req.params.id, null, result);
    return ok(res, result);
  } catch (err) { next(err); }
});
