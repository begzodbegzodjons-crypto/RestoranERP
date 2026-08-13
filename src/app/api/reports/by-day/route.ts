import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'today';

    // Calculate date range
    const now = new Date();
    let from = new Date(now);
    from.setUTCHours(0-5, 0, 0, 0);
    if (period === 'week') from.setDate(from.getDate() - 6);
    if (period === 'month') from.setDate(from.getDate() - 29);
    if (period === 'yesterday') { from.setDate(from.getDate() - 1); }
    if (period === 'custom') {
      const f = url.searchParams.get('from');
      if (f) from = new Date(f);
    }

    let sql = '';
    let params: unknown[] = [payload.restaurantId, from, now];

    switch ('by-day') {
      case 'by-day':
        sql = `SELECT DATE(paid_at) AS sale_date, COUNT(*) AS payments_count,
                COALESCE(SUM(total_paid),0) AS total_sales, COALESCE(SUM(cash_amount),0) AS cash_sales,
                COALESCE(SUM(card_amount),0) AS card_sales, COALESCE(SUM(click_amount),0) AS click_sales,
                COALESCE(SUM(payme_amount),0) AS payme_sales
              FROM payments WHERE restaurant_id = ? AND paid_at >= ? AND paid_at < ?
              GROUP BY DATE(paid_at) ORDER BY sale_date ASC`;
        break;
      case 'by-product':
        sql = `SELECT oi.product_id, oi.name AS product_name, oi.station,
                SUM(oi.quantity) AS total_quantity, SUM(oi.line_total) AS total_revenue,
                SUM(oi.cost_price * oi.quantity) AS total_cost
              FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN payments p ON p.order_id = o.id
              WHERE p.restaurant_id = ? AND oi.status <> 'cancelled' AND p.paid_at >= ? AND p.paid_at < ?
              GROUP BY oi.product_id, oi.name, oi.station ORDER BY total_quantity DESC LIMIT 20`;
        break;
      case 'by-category':
        sql = `SELECT c.id AS category_id, c.name AS category_name, c.station,
                COUNT(DISTINCT oi.order_id) AS orders_count, SUM(oi.quantity) AS total_quantity,
                SUM(oi.line_total) AS total_revenue
              FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN payments p ON p.order_id = o.id
              LEFT JOIN products pr ON pr.id = oi.product_id LEFT JOIN categories c ON c.id = pr.category_id
              WHERE p.restaurant_id = ? AND oi.status <> 'cancelled' AND p.paid_at >= ? AND p.paid_at < ?
              GROUP BY c.id, c.name, c.station ORDER BY total_revenue DESC`;
        break;
      case 'by-waiter':
        sql = `SELECT o.waiter_id, u.name AS waiter_name, COUNT(DISTINCT o.id) AS orders_count,
                SUM(p.total_paid) AS total_sales, SUM(p.tip_amount) AS total_tips, AVG(p.total_paid) AS avg_order_value
              FROM payments p JOIN orders o ON o.id = p.order_id LEFT JOIN users u ON u.id = o.waiter_id
              WHERE p.restaurant_id = ? AND p.paid_at >= ? AND p.paid_at < ?
              GROUP BY o.waiter_id, u.name ORDER BY total_sales DESC`;
        break;
      case 'by-station':
        sql = `SELECT oi.station, COUNT(DISTINCT oi.order_id) AS orders_count,
                SUM(oi.quantity) AS total_quantity, SUM(oi.line_total) AS total_revenue,
                SUM(oi.cost_price * oi.quantity) AS total_cost
              FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN payments p ON p.order_id = o.id
              WHERE p.restaurant_id = ? AND oi.status <> 'cancelled' AND p.paid_at >= ? AND p.paid_at < ?
              GROUP BY oi.station ORDER BY total_revenue DESC`;
        break;
    }

    const { rows } = await query(sql, params);
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
