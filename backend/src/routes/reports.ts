/**
 * REPORTS routes — today's sales, range report, Z-report close, top products.
 *
 * GET  /api/reports/today            — sales since last Z-report (uses v_today_sales view)
 * GET  /api/reports/range            — sales in custom date range
 * GET  /api/reports/z-report         — preview Z-report
 * POST /api/reports/z-report/close   — close Z-report (reset cutoff)
 * GET  /api/reports/top-products     — best sellers since last Z-report
 * GET  /api/reports/by-waiter        — waiter sales breakdown
 * GET  /api/reports/by-payment-method — payment method totals
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, requirePerm, auditReq } from '../middleware';
import { ok } from '../utils/response';
import { NotFoundError } from '../errors';
import { entityId } from '../utils/id';

export const reportsRouter = Router();

reportsRouter.use(authRequired);

reportsRouter.get('/today', requirePerm('report.view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM v_today_sales WHERE restaurant_id = ?`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows[0] ?? {
      restaurant_id: req.ctx!.restaurantId,
      payments_count: 0, total_sales: 0, cash_sales: 0, card_sales: 0,
      click_sales: 0, payme_sales: 0, tips: 0, discounts: 0, change_given: 0
    });
  } catch (err) { next(err); }
});

reportsRouter.get('/range', requirePerm('report.view'), async (req, res, next) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) return res.status(400).json({ ok: false, message: 'from and to required' });
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS payments_count,
         COALESCE(SUM(total_paid), 0) AS total_sales,
         COALESCE(SUM(cash_amount), 0) AS cash_sales,
         COALESCE(SUM(card_amount), 0) AS card_sales,
         COALESCE(SUM(click_amount), 0) AS click_sales,
         COALESCE(SUM(payme_amount), 0) AS payme_sales,
         COALESCE(SUM(tip_amount), 0) AS tips,
         COALESCE(SUM(discount_amount), 0) AS discounts
       FROM payments
       WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < ?`,
      [req.ctx!.restaurantId, from, to]
    );
    return ok(res, rows[0]);
  } catch (err) { next(err); }
});

reportsRouter.get('/z-report', requirePerm('report.view'), async (req, res, next) => {
  try {
    const [restRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, last_z_report_at FROM restaurants WHERE id = ?`,
      [req.ctx!.restaurantId]
    );
    if (restRows.length === 0) throw new NotFoundError('Restaurant');
    const cutoff = restRows[0].last_z_report_at ?? new Date(0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS payments_count,
         COALESCE(SUM(total_paid), 0) AS total_sales,
         COALESCE(SUM(cash_amount), 0) AS cash_sales,
         COALESCE(SUM(card_amount), 0) AS card_sales,
         COALESCE(SUM(click_amount), 0) AS click_sales,
         COALESCE(SUM(payme_amount), 0) AS payme_sales,
         COALESCE(SUM(tip_amount), 0) AS tips,
         COALESCE(SUM(discount_amount), 0) AS discounts,
         ? AS cutoff_from,
         NOW() AS cutoff_to
       FROM payments
       WHERE restaurant_id = ? AND paid_at >= ?`,
      [cutoff, req.ctx!.restaurantId, cutoff]
    );
    // Void count in period
    const [voidRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS voids FROM orders
        WHERE restaurant_id = ? AND status = 'cancelled'
          AND updated_at >= ?`,
      [req.ctx!.restaurantId, cutoff]
    );
    return ok(res, { ...rows[0], ...voidRows[0] });
  } catch (err) { next(err); }
});

reportsRouter.post('/z-report/close', requirePerm('report.zreport'), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      // Lock restaurant row
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id, last_z_report_at FROM restaurants WHERE id = ? FOR UPDATE`,
        [req.ctx!.restaurantId]
      );
      if (rows.length === 0) throw new NotFoundError('Restaurant');
      const prevAt = rows[0].last_z_report_at ?? new Date(0);
      const now = new Date();

      // Aggregate sales since prevAt
      const [aggRows] = await conn.query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(total_paid), 0) AS total_sales,
           COALESCE(SUM(cash_amount), 0) AS cash_sales,
           COALESCE(SUM(card_amount), 0) AS card_sales,
           COALESCE(SUM(click_amount), 0) AS click_sales,
           COALESCE(SUM(payme_amount), 0) AS payme_sales
         FROM payments
         WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < NOW(3)`,
        [req.ctx!.restaurantId, prevAt]
      );
      const totals = aggRows[0];

      // Void count
      const [voidRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS v FROM orders
          WHERE restaurant_id = ? AND status = 'cancelled' AND updated_at >= ?`,
        [req.ctx!.restaurantId, prevAt]
      );

      // Update cutoff
      await conn.execute(
        `UPDATE restaurants SET last_z_report_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [req.ctx!.restaurantId]
      );

      // Audit log
      await conn.execute(
        `INSERT INTO audit_logs (restaurant_id, user_id, action, entity, entity_id, before, after, created_at)
         VALUES (?, ?, 'z_report_close', 'restaurant', ?, ?, ?, NOW(3))`,
        [req.ctx!.restaurantId, req.ctx!.userId, req.ctx!.restaurantId,
         JSON.stringify({ last_z_report_at: prevAt }),
         JSON.stringify({ last_z_report_at: now, ...totals, voids: voidRows[0].v })]
      );

      // Queue Z-report print job (if cashier printer configured)
      const [printerRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM printers WHERE restaurant_id = ? AND station = 'cashier' AND is_active = 1 LIMIT 1`,
        [req.ctx!.restaurantId]
      );
      if (printerRows.length > 0) {
        await conn.execute(
          `INSERT INTO print_jobs (id, restaurant_id, printer_id, order_id, payment_id, type, payload, status, idempotency_key, queued_at)
           VALUES (?, ?, ?, NULL, NULL, 'zreport', X'1B40', 'pending', ?, NOW(3))`,
          [entityId('pj'), req.ctx!.restaurantId, printerRows[0].id, `zrep_${Date.now()}`]
        );
      }

      return { closedAt: now, periodFrom: prevAt, ...totals, voids: voidRows[0].v };
    });
    await auditReq(req, 'z_report_close', 'restaurant', req.ctx!.restaurantId, null, result);
    return ok(res, result);
  } catch (err) { next(err); }
});

reportsRouter.get('/top-products', requirePerm('report.view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM v_top_products WHERE restaurant_id = ? ORDER BY total_quantity DESC LIMIT 20`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

reportsRouter.get('/by-waiter', requirePerm('report.view'), async (req, res, next) => {
  try {
    const [restRows] = await pool.query<RowDataPacket[]>(
      `SELECT last_z_report_at FROM restaurants WHERE id = ?`,
      [req.ctx!.restaurantId]
    );
    const cutoff = restRows[0]?.last_z_report_at ?? new Date(0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT o.waiter_id, u.name AS waiter_name,
              COUNT(DISTINCT o.id) AS orders_count,
              SUM(p.total_paid) AS total_sales
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         LEFT JOIN users u ON u.id = o.waiter_id
        WHERE p.restaurant_id = ? AND p.paid_at >= ?
        GROUP BY o.waiter_id, u.name
        ORDER BY total_sales DESC`,
      [req.ctx!.restaurantId, cutoff]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});
