import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest, { params }: { params: { station: string } }) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });

    const { rows } = await query(
      `SELECT oi.id AS order_item_id, oi.order_id, o.restaurant_id, o.order_number, o.table_id,
              t.name AS table_name, oi.product_id, oi.name AS product_name, oi.quantity,
              oi.unit_price, oi.line_total, oi.notes, oi.station, oi.status, oi.chef_id,
              c.name AS chef_name, oi.started_at, oi.ready_at, oi.served_at,
              o.opened_at, o.waiter_id, w.name AS waiter_name,
              TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) AS age_seconds,
              CASE
                WHEN oi.status = 'cooking' AND TIMESTAMPDIFF(SECOND, oi.started_at, NOW()) > 600 THEN 'overdue'
                WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 300 THEN 'overdue'
                WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 120 THEN 'warning'
                ELSE 'ok'
              END AS urgency
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN tables t ON t.id = o.table_id LEFT JOIN users c ON c.id = oi.chef_id LEFT JOIN users w ON w.id = o.waiter_id
       WHERE o.restaurant_id = ? AND oi.station = ? AND oi.status IN ('pending', 'cooking', 'ready') AND o.status NOT IN ('cancelled', 'paid')
       ORDER BY CASE oi.status WHEN 'pending' THEN 0 WHEN 'cooking' THEN 1 WHEN 'ready' THEN 2 END, o.opened_at ASC`,
      [payload.restaurantId, params.station]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
