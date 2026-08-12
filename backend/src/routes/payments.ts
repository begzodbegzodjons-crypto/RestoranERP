/**
 * PAYMENTS routes — atomic payment processing.
 *
 * POST   /api/payments               — process payment (atomic + idempotent)
 * GET    /api/payments               — list payments (filters: from, to, method, cashierId)
 * GET    /api/payments/:id           — get payment detail
 * POST   /api/payments/:id/refund    — refund a payment (admin only)
 *
 * ATOMIC PAYMENT (withTransaction):
 *   1. SELECT FOR UPDATE order (lock)
 *   2. Check payment_status='unpaid' (idempotency)
 *   3. Check version (optimistic lock)
 *   4. INSERT payment (UNIQUE on idempotency_key + UNIQUE on order_id)
 *   5. INSERT payment_items for each method
 *   6. UPDATE order status=paid, version++, closed_at
 *   7. UPDATE tables status=free, current_order_id=NULL
 *   8. UPDATE shift totals
 *   9. INSERT inventory_transactions (out, set-based)
 *  10. UPDATE inventory stock (decrement, set-based)
 *  11. INSERT order_event 'paid'
 *  12. INSERT print_jobs (receipt)
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { payOrderSchema, listPaymentsQuerySchema } from '../validation/payment';
import { z } from 'zod';
import { NotFoundError, ConflictError, AppError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';
import { writeAudit } from '../audit';

export const paymentsRouter = Router();

paymentsRouter.use(authRequired);

// ============================================================
// PROCESS PAYMENT (atomic + idempotent)
// ============================================================
paymentsRouter.post('/', requirePerm('payment.create'), validateBody(payOrderSchema), async (req, res, next) => {
  try {
    const input = req.body;
    const restaurantId = req.ctx!.restaurantId;
    const cashierId = req.ctx!.userId;
    const paymentId = entityId('pay');

    const result = await withTransaction(async (conn) => {
      // 1. Lock order row
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status, payment_status, version, table_id, subtotal
           FROM orders
          WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL
          FOR UPDATE`,
        [input.orderId, restaurantId]
      );
      if (orderRows.length === 0) throw new NotFoundError('Order', input.orderId);
      const order = orderRows[0];

      // 2. Idempotency check — already paid?
      if (order.payment_status === 'paid') {
        const [existing] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM payments WHERE order_id = ? LIMIT 1`,
          [order.id]
        );
        if (existing.length > 0) {
          return { replayed: true, paymentId: existing[0].id, orderId: order.id };
        }
        throw new ConflictError('Order marked paid but no payment record found');
      }

      // 3. Optimistic lock check
      if (order.version !== input.version) {
        throw new ConflictError(
          `Order version mismatch (expected ${input.version}, got ${order.version}). Refresh and retry.`,
          { expectedVersion: input.version, currentVersion: order.version }
        );
      }

      // 4. Try INSERT payment — UNIQUE(idempotency_key) catches duplicate
      try {
        await conn.execute(
          `INSERT INTO payments
             (id, restaurant_id, order_id, shift_id, cashier_id,
              subtotal, discount_amount, tax_amount, tip_amount, total_paid, change_amount,
              payment_method, cash_amount, card_amount, click_amount, payme_amount,
              reference, idempotency_key, paid_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [paymentId, restaurantId, order.id, input.shiftId ?? null, cashierId,
           input.subtotal, input.discountAmount, input.taxAmount, input.tipAmount, input.totalPaid, input.changeAmount,
           input.paymentMethod, input.cashAmount, input.cardAmount, input.clickAmount, input.paymeAmount,
           input.reference ?? null, input.idempotencyKey]
        );
      } catch (err: any) {
        if (err.errno === 1062) {
          // Idempotency replay
          const [existing] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM payments WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1`,
            [restaurantId, input.idempotencyKey]
          );
          if (existing.length > 0) {
            return { replayed: true, paymentId: existing[0].id, orderId: order.id };
          }
        }
        throw err;
      }

      // 5. Insert payment_items for each method with non-zero amount
      const methodAmounts: { method: string; amount: number }[] = [
        { method: 'cash', amount: input.cashAmount },
        { method: 'card', amount: input.cardAmount },
        { method: 'click', amount: input.clickAmount },
        { method: 'payme', amount: input.paymeAmount },
      ].filter(m => m.amount > 0);

      for (const m of methodAmounts) {
        await conn.execute(
          `INSERT INTO payment_items (id, payment_id, method, amount, reference, created_at)
           VALUES (?, ?, ?, ?, ?, NOW(3))`,
          [entityId('pi'), paymentId, m.method, m.amount, null]
        );
      }

      // 6. Update order: paid + version bump + closed_at
      await conn.execute(
        `UPDATE orders
           SET status = 'paid',
               payment_status = 'paid',
               cashier_id = ?,
               subtotal = ?,
               discount_amount = ?,
               tax_amount = ?,
               tip_amount = ?,
               total = ?,
               version = version + 1,
               closed_at = NOW(3),
               updated_at = NOW(3)
         WHERE id = ?`,
        [cashierId, input.subtotal, input.discountAmount, input.taxAmount,
         input.tipAmount, input.totalPaid, order.id]
      );

      // 7. Free the table
      if (order.table_id) {
        await conn.execute(
          `UPDATE tables SET status = 'free', current_order_id = NULL, updated_at = NOW(3) WHERE id = ?`,
          [order.table_id]
        );
      }

      // 8. Update shift totals
      if (input.shiftId) {
        await conn.execute(
          `UPDATE shifts
              SET total_sales = total_sales + ?,
                  cash_sales  = cash_sales  + ?,
                  card_sales  = card_sales  + ?,
                  click_sales = click_sales + ?,
                  payme_sales = payme_sales + ?,
                  updated_at = NOW(3)
            WHERE id = ? AND restaurant_id = ?`,
          [input.totalPaid, input.cashAmount, input.cardAmount, input.clickAmount, input.paymeAmount,
           input.shiftId, restaurantId]
        );
      }

      // 9. Consume inventory (set-based)
      //    For each order_item that is NOT cancelled, look up recipes and decrement stock.
      await conn.execute(
        `INSERT INTO inventory_transactions
           (inventory_id, restaurant_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
         SELECT r.inventory_id, ?, 'out',
                -(r.quantity * oi.quantity),
                i.cost,
                CONCAT('Order consumed: product=', oi.product_id, ' qty=', oi.quantity),
                'order', ?, ?, NOW(3)
           FROM order_items oi
           JOIN recipes r ON r.product_id = oi.product_id
           JOIN inventory i ON i.id = r.inventory_id
          WHERE oi.order_id = ? AND oi.status <> 'cancelled'`,
        [restaurantId, order.id, cashierId, order.id]
      );

      // 10. Decrement stock (set-based)
      await conn.execute(
        `UPDATE inventory i
          JOIN (
            SELECT r.inventory_id AS inv_id, SUM(r.quantity * oi.quantity) AS total_consumed
              FROM order_items oi
              JOIN recipes r ON r.product_id = oi.product_id
             WHERE oi.order_id = ? AND oi.status <> 'cancelled'
             GROUP BY r.inventory_id
          ) AS agg ON agg.inv_id = i.id
           SET i.stock = i.stock - agg.total_consumed,
               i.updated_at = NOW(3)`,
        [order.id]
      );

      // 11. Insert order_event
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'paid', ?, ?, NOW(3))`,
        [order.id, restaurantId, cashierId,
         JSON.stringify({ paymentId, method: input.paymentMethod, total: input.totalPaid })]
      );

      // 12. Queue receipt print job
      await conn.execute(
        `INSERT INTO print_jobs
           (id, restaurant_id, printer_id, order_id, payment_id, type, payload, status, idempotency_key, queued_at)
         VALUES (?, ?, ?, ?, ?, 'receipt', X'1B40', 'pending', ?, NOW(3))`,
        [entityId('pj'), restaurantId, input.cashierPrinterId,
         order.id, paymentId, `rcpt_${input.idempotencyKey}`.slice(0, 36)]
      );

      return { replayed: false, paymentId, orderId: order.id };
    });

    await auditReq(req, 'pay', 'payment', result.paymentId, null, {
      orderId: input.orderId, method: input.paymentMethod, total: input.totalPaid,
      idempotent: result.replayed,
    });

    if (result.replayed) {
      return res.status(200).json({
        ok: true, code: 'IDEMPOTENT_REPLAY', idempotent: true,
        data: { paymentId: result.paymentId, orderId: result.orderId }
      });
    }
    return created(res, { paymentId: result.paymentId, orderId: result.orderId });
  } catch (err) { next(err); }
});

// ============================================================
// LIST PAYMENTS
// ============================================================
paymentsRouter.get('/', requirePerm('payment.read'), async (req, res, next) => {
  try {
    const parsed = listPaymentsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Bad query', parsed.error.flatten());
    const q = parsed.data;
    const where: string[] = ['p.restaurant_id = ?'];
    const params: unknown[] = [req.ctx!.restaurantId];
    if (q.from) { where.push('p.paid_at >= ?'); params.push(q.from); }
    if (q.to) { where.push('p.paid_at < ?'); params.push(q.to); }
    if (q.method) { where.push('p.payment_method = ?'); params.push(q.method); }
    if (q.cashierId) { where.push('p.cashier_id = ?'); params.push(q.cashierId); }
    const limit = q.limit; const offset = (q.page - 1) * limit;
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, o.order_number, o.table_id, t.name AS table_name, u.name AS cashier_name
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         LEFT JOIN tables t ON t.id = o.table_id
         LEFT JOIN users u ON u.id = p.cashier_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.paid_at DESC
        LIMIT ? OFFSET ?`,
      params
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// GET PAYMENT DETAIL
// ============================================================
paymentsRouter.get('/:id', requirePerm('payment.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, o.order_number, o.table_id
         FROM payments p
         JOIN orders o ON o.id = p.order_id
        WHERE p.id = ? AND p.restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (rows.length === 0) throw new NotFoundError('Payment', req.params.id);
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM payment_items WHERE payment_id = ?`,
      [req.params.id]
    );
    return ok(res, { ...rows[0], items });
  } catch (err) { next(err); }
});

// ============================================================
// REFUND
// ============================================================
const refundSchema = z.object({
  reason: z.string().min(1).max(500),
  amount: z.number().min(0).optional(), // partial refund if provided
});

paymentsRouter.post('/:id/refund', requirePerm('payment.refund'), validateBody(refundSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [payRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, order_id, total_paid, payment_method FROM payments
          WHERE id = ? AND restaurant_id = ? FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (payRows.length === 0) throw new NotFoundError('Payment', req.params.id);
      const payment = payRows[0];

      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, payment_status, version FROM orders WHERE id = ? FOR UPDATE`,
        [payment.order_id]
      );
      const order = orderRows[0];
      if (order.payment_status === 'refunded') throw new ConflictError('Payment already refunded');

      await conn.execute(
        `UPDATE orders SET payment_status = 'refunded', version = version + 1, updated_at = NOW(3) WHERE id = ?`,
        [order.id]
      );
      await conn.execute(
        `INSERT INTO order_events (order_id, restaurant_id, type, user_id, payload, created_at)
         VALUES (?, ?, 'refunded', ?, ?, NOW(3))`,
        [order.id, req.ctx!.restaurantId, req.ctx!.userId,
         JSON.stringify({ paymentId: payment.id, reason: req.body.reason })]
      );
      return { paymentId: payment.id, orderId: order.id, refunded: true };
    });
    await auditReq(req, 'refund', 'payment', req.params.id, null, req.body);
    return ok(res, result);
  } catch (err) { next(err); }
});
