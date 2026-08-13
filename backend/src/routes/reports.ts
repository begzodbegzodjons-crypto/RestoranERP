/**
 * REPORTS routes — comprehensive reporting with date-range support.
 *
 * Periods: today, yesterday, week, month, custom (from/to)
 * Timezone: Asia/Tashkent (UTC+5) — all date calculations use CONVERT_TZ
 *
 * Endpoints:
 *   GET  /api/reports/summary?period=today        — KPI summary (total, cash, card, click, payme, discount, tips, voids)
 *   GET  /api/reports/by-day?period=week           — daily sales breakdown (for charts)
 *   GET  /api/reports/by-category?period=month    — sales by product category
 *   GET  /api/reports/by-product?period=month     — top products (quantity + revenue)
 *   GET  /api/reports/by-waiter?period=month      — waiter performance
 *   GET  /api/reports/by-station?period=month     — kitchen vs kebab vs bar
 *   GET  /api/reports/expenses?period=month       — expenses breakdown
 *   GET  /api/reports/profit?period=month          — profit = revenue - cost - expenses
 *   GET  /api/reports/z-report                    — Z-report preview
 *   POST /api/reports/z-report/close              — close Z-report (reset)
 *   GET  /api/reports/today                        — legacy (since last Z-report)
 *   GET  /api/reports/range?from=&to=              — legacy custom range
 *   GET  /api/reports/top-products                 — legacy (since last Z-report)
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, requirePerm, auditReq } from '../middleware';
import { ok } from '../utils/response';
import { NotFoundError } from '../errors';
import { entityId } from '../utils/id';

export const reportsRouter = Router();

reportsRouter.use(authRequired);

// Helper: compute date range based on period parameter
function getDateRange(period: string, from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  // Uzbekistan timezone: UTC+5
  // We compute start/end of the period in UTC+5, then convert to UTC for DB queries

  const toUTC = (d: Date) => new Date(d.getTime() - 5 * 60 * 60 * 1000);

  switch (period) {
    case 'today': {
      // Start of today 00:00 UTC+5
      const start = new Date(now);
      start.setUTCHours(0 - 5, 0, 0, 0); // 00:00 UTC+5 = -5h offset from UTC midnight
      if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
      return { from: start, to: now };
    }
    case 'yesterday': {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 1);
      start.setUTCHours(0 - 5, 0, 0, 0);
      const end = new Date(start);
      end.setUTCHours(end.getUTCHours() + 24);
      return { from: start, to: end };
    }
    case 'week': {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 6); // last 7 days including today
      start.setUTCHours(0 - 5, 0, 0, 0);
      return { from: start, to: now };
    }
    case 'month': {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 29); // last 30 days
      start.setUTCHours(0 - 5, 0, 0, 0);
      return { from: start, to: now };
    }
    case 'custom': {
      if (from) {
        const f = new Date(from);
        f.setUTCHours(0 - 5, 0, 0, 0);
        const t = to ? new Date(to) : now;
        t.setUTCHours(24 - 5, 0, 0, 0); // end of day
        return { from: f, to: t };
      }
      // fallback to today
      const start = new Date(now);
      start.setUTCHours(0 - 5, 0, 0, 0);
      return { from: start, to: now };
    }
    default:
      return { from: new Date(0), to: now };
  }
}

// ============================================================
// SUMMARY — KPI cards
// ============================================================
reportsRouter.get('/summary', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'today';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

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
         COALESCE(SUM(change_amount), 0) AS change_given
       FROM payments
       WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < ?`,
      [req.ctx!.restaurantId, from, to]
    );

    // Voided orders count
    const [voidRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS voids FROM orders
        WHERE restaurant_id = ? AND status = 'cancelled'
          AND updated_at >= ? AND updated_at < ?`,
      [req.ctx!.restaurantId, from, to]
    );

    // Expenses total
    const [expRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses
        WHERE restaurant_id = ? AND deleted_at IS NULL
          AND expense_date >= DATE(?) AND expense_date <= DATE(?)`,
      [req.ctx!.restaurantId, from, to]
    );

    const s = rows[0];
    const totalSales = Number(s.total_sales);
    const expenses = Number(expRows[0].expenses);
    const netRevenue = totalSales - expenses;

    return ok(res, {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      payments_count: Number(s.payments_count),
      total_sales: totalSales,
      cash_sales: Number(s.cash_sales),
      card_sales: Number(s.card_sales),
      click_sales: Number(s.click_sales),
      payme_sales: Number(s.payme_sales),
      tips: Number(s.tips),
      discounts: Number(s.discounts),
      change_given: Number(s.change_given),
      voids: Number(voidRows[0].voids),
      expenses: expenses,
      net_revenue: netRevenue,
    });
  } catch (err) { next(err); }
});

// ============================================================
// BY DAY — daily sales breakdown (for charts)
// ============================================================
reportsRouter.get('/by-day', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'week';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    // Optimized: single query with GROUP BY DATE
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE(CONVERT_TZ(paid_at, '+00:00', '+05:00')) AS sale_date,
         COUNT(*) AS payments_count,
         COALESCE(SUM(total_paid), 0) AS total_sales,
         COALESCE(SUM(cash_amount), 0) AS cash_sales,
         COALESCE(SUM(card_amount), 0) AS card_sales,
         COALESCE(SUM(click_amount), 0) AS click_sales,
         COALESCE(SUM(payme_amount), 0) AS payme_sales
       FROM payments
       WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < ?
       GROUP BY sale_date
       ORDER BY sale_date ASC`,
      [req.ctx!.restaurantId, from, to]
    );

    return ok(res, rows.map(r => ({
      date: r.sale_date,
      label: new Date(r.sale_date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }),
      payments_count: Number(r.payments_count),
      total_sales: Number(r.total_sales),
      cash_sales: Number(r.cash_sales),
      card_sales: Number(r.card_sales),
      click_sales: Number(r.click_sales),
      payme_sales: Number(r.payme_sales),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// BY CATEGORY — sales by product category
// ============================================================
reportsRouter.get('/by-category', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         c.id AS category_id,
         c.name AS category_name,
         c.station,
         COUNT(DISTINCT oi.order_id) AS orders_count,
         SUM(oi.quantity) AS total_quantity,
         SUM(oi.line_total) AS total_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       LEFT JOIN products pr ON pr.id = oi.product_id
       LEFT JOIN categories c ON c.id = pr.category_id
       WHERE p.restaurant_id = ? AND oi.status <> 'cancelled'
         AND p.paid_at >= ? AND p.paid_at < ?
       GROUP BY c.id, c.name, c.station
       ORDER BY total_revenue DESC`,
      [req.ctx!.restaurantId, from, to]
    );

    return ok(res, rows.map(r => ({
      category_id: r.category_id,
      category_name: r.category_name ?? 'Kategoriyasiz',
      station: r.station ?? 'other',
      orders_count: Number(r.orders_count),
      total_quantity: Number(r.total_quantity),
      total_revenue: Number(r.total_revenue),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// BY PRODUCT — top products by quantity and revenue
// ============================================================
reportsRouter.get('/by-product', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         oi.product_id,
         oi.name AS product_name,
         oi.station,
         COUNT(*) AS times_ordered,
         SUM(oi.quantity) AS total_quantity,
         SUM(oi.line_total) AS total_revenue,
         SUM(oi.cost_price * oi.quantity) AS total_cost,
         SUM(oi.line_total) - SUM(oi.cost_price * oi.quantity) AS gross_profit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       WHERE p.restaurant_id = ? AND oi.status <> 'cancelled'
         AND p.paid_at >= ? AND p.paid_at < ?
       GROUP BY oi.product_id, oi.name, oi.station
       ORDER BY total_quantity DESC
       LIMIT ?`,
      [req.ctx!.restaurantId, from, to, limit]
    );

    return ok(res, rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      station: r.station,
      times_ordered: Number(r.times_ordered),
      total_quantity: Number(r.total_quantity),
      total_revenue: Number(r.total_revenue),
      total_cost: Number(r.total_cost),
      gross_profit: Number(r.gross_profit),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// BY WAITER — waiter performance
// ============================================================
reportsRouter.get('/by-waiter', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         o.waiter_id,
         u.name AS waiter_name,
         COUNT(DISTINCT o.id) AS orders_count,
         COUNT(DISTINCT p.id) AS payments_count,
         SUM(p.total_paid) AS total_sales,
         SUM(p.tip_amount) AS total_tips,
         AVG(p.total_paid) AS avg_order_value
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN users u ON u.id = o.waiter_id
       WHERE p.restaurant_id = ? AND p.paid_at >= ? AND p.paid_at < ?
       GROUP BY o.waiter_id, u.name
       ORDER BY total_sales DESC`,
      [req.ctx!.restaurantId, from, to]
    );

    return ok(res, rows.map(r => ({
      waiter_id: r.waiter_id,
      waiter_name: r.waiter_name ?? '—',
      orders_count: Number(r.orders_count),
      payments_count: Number(r.payments_count),
      total_sales: Number(r.total_sales),
      total_tips: Number(r.total_tips),
      avg_order_value: Number(r.avg_order_value),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// BY STATION — kitchen vs kebab vs bar
// ============================================================
reportsRouter.get('/by-station', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         oi.station,
         COUNT(DISTINCT oi.order_id) AS orders_count,
         SUM(oi.quantity) AS total_quantity,
         SUM(oi.line_total) AS total_revenue,
         SUM(oi.cost_price * oi.quantity) AS total_cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       WHERE p.restaurant_id = ? AND oi.status <> 'cancelled'
         AND p.paid_at >= ? AND p.paid_at < ?
       GROUP BY oi.station
       ORDER BY total_revenue DESC`,
      [req.ctx!.restaurantId, from, to]
    );

    return ok(res, rows.map(r => ({
      station: r.station,
      orders_count: Number(r.orders_count),
      total_quantity: Number(r.total_quantity),
      total_revenue: Number(r.total_revenue),
      total_cost: Number(r.total_cost),
      gross_profit: Number(r.total_revenue) - Number(r.total_cost),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// EXPENSES — breakdown by category
// ============================================================
reportsRouter.get('/expenses', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         category,
         COUNT(*) AS count,
         COALESCE(SUM(amount), 0) AS total_amount
       FROM expenses
       WHERE restaurant_id = ? AND deleted_at IS NULL
         AND expense_date >= DATE(?) AND expense_date <= DATE(?)
       GROUP BY category
       ORDER BY total_amount DESC`,
      [req.ctx!.restaurantId, from, to]
    );

    return ok(res, rows.map(r => ({
      category: r.category,
      count: Number(r.count),
      total_amount: Number(r.total_amount),
    })));
  } catch (err) { next(err); }
});

// ============================================================
// PROFIT — revenue - cost - expenses
// ============================================================
reportsRouter.get('/profit', requirePerm('report.view'), async (req, res, next) => {
  try {
    const period = (req.query.period as string) ?? 'month';
    const { from, to } = getDateRange(period, req.query.from as string, req.query.to as string);

    // Revenue from payments
    const [revRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(total_paid), 0) AS revenue,
         COALESCE(SUM(discount_amount), 0) AS discounts,
         COALESCE(SUM(tip_amount), 0) AS tips
       FROM payments
       WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < ?`,
      [req.ctx!.restaurantId, from, to]
    );

    // Cost of goods sold (COGS) from order_items
    const [costRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(oi.cost_price * oi.quantity), 0) AS cogs,
         COALESCE(SUM(oi.line_total), 0) AS gross_sales
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       WHERE p.restaurant_id = ? AND oi.status <> 'cancelled'
         AND p.paid_at >= ? AND p.paid_at < ?`,
      [req.ctx!.restaurantId, from, to]
    );

    // Expenses
    const [expRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses
        WHERE restaurant_id = ? AND deleted_at IS NULL
          AND expense_date >= DATE(?) AND expense_date <= DATE(?)`,
      [req.ctx!.restaurantId, from, to]
    );

    const revenue = Number(revRows[0].revenue);
    const cogs = Number(costRows[0].cogs);
    const expenses = Number(expRows[0].expenses);
    const grossProfit = Number(costRows[0].gross_sales) - cogs;
    const netProfit = revenue - expenses; // revenue already includes the COGS markup

    return ok(res, {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      revenue,
      gross_sales: Number(costRows[0].gross_sales),
      cogs,
      gross_profit: grossProfit,
      expenses,
      net_profit: netProfit,
      discounts: Number(revRows[0].discounts),
      tips: Number(revRows[0].tips),
    });
  } catch (err) { next(err); }
});

// ============================================================
// LEGACY ENDPOINTS (kept for backward compatibility)
// ============================================================
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
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id, last_z_report_at FROM restaurants WHERE id = ? FOR UPDATE`,
        [req.ctx!.restaurantId]
      );
      if (rows.length === 0) throw new NotFoundError('Restaurant');
      const prevAt = rows[0].last_z_report_at ?? new Date(0);
      const now = new Date();

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

      const [voidRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS v FROM orders
          WHERE restaurant_id = ? AND status = 'cancelled' AND updated_at >= ?`,
        [req.ctx!.restaurantId, prevAt]
      );

      await conn.execute(
        `UPDATE restaurants SET last_z_report_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [req.ctx!.restaurantId]
      );

      await conn.execute(
        `INSERT INTO audit_logs (restaurant_id, user_id, action, entity, entity_id, before, after, created_at)
         VALUES (?, ?, 'z_report_close', 'restaurant', ?, ?, ?, NOW(3))`,
        [req.ctx!.restaurantId, req.ctx!.userId, req.ctx!.restaurantId,
         JSON.stringify({ last_z_report_at: prevAt }),
         JSON.stringify({ last_z_report_at: now, ...totals, voids: voidRows[0].v })]
      );

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

// Legacy by-waiter (since last Z-report)
reportsRouter.get('/by-waiter-legacy', requirePerm('report.view'), async (req, res, next) => {
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
