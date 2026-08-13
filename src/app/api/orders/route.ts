import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId, uuid } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

function getCtx(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    return { userId: payload.sub, restaurantId: payload.restaurantId };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = getCtx(req);
    if (!ctx) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const { rows } = await query(
      `SELECT o.id, o.order_number, o.table_id, t.name AS table_name, o.waiter_id, w.name AS waiter_name,
              o.order_type, o.status, o.payment_status, o.subtotal, o.discount_amount, o.tax_amount,
              o.tip_amount, o.total, o.opened_at, o.closed_at, o.created_at, o.version
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id LEFT JOIN users w ON w.id = o.waiter_id
       WHERE o.restaurant_id = ? AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 50`,
      [ctx.restaurantId]
    );
    return NextResponse.json({ ok: true, data: { items: rows, total: rows.length, page: 1, limit: 50 } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = getCtx(req);
    if (!ctx) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    
    const body = await req.json();
    const orderId = entityId('ord');
    const orderNumber = `${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    let subtotal = 0;

    // Check idempotency
    const { rows: existing } = await query(
      `SELECT id FROM orders WHERE restaurant_id = ? AND idempotency_key = ? LIMIT 1`,
      [ctx.restaurantId, body.idempotencyKey]
    );
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, idempotent: true, data: { id: existing[0].id } });
    }

    // Create order
    await execute(
      `INSERT INTO orders (id, restaurant_id, order_number, table_id, waiter_id, order_type,
          status, payment_status, subtotal, discount_amount, tax_amount, tip_amount, total,
          idempotency_key, version, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 'unpaid', 0, 0, 0, 0, 0, ?, 1, NOW(3), NOW(3), NOW(3))`,
      [orderId, ctx.restaurantId, orderNumber, body.tableId ?? null, ctx.userId,
       body.orderType ?? 'dine_in', body.idempotencyKey]
    );

    // Insert items
    for (const item of body.items) {
      const itemId = entityId('itm');
      const lineTotal = Number(item.unitPrice) * Number(item.quantity);
      subtotal += lineTotal;
      await execute(
        `INSERT INTO order_items (id, order_id, product_id, name, unit_price, cost_price,
            quantity, line_total, notes, station, status, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(3), NOW(3))`,
        [itemId, orderId, item.productId, item.name, Number(item.unitPrice),
         Number(item.costPrice ?? 0), Number(item.quantity), lineTotal,
         item.notes ?? null, item.station ?? 'kitchen', uuid()]
      );
    }

    // Update totals
    await execute(`UPDATE orders SET subtotal = ?, total = ?, updated_at = NOW(3) WHERE id = ?`, [subtotal, subtotal, orderId]);

    // Occupy table
    if (body.tableId) {
      await execute(`UPDATE tables SET status = 'occupied', current_order_id = ?, updated_at = NOW(3) WHERE id = ?`, [orderId, body.tableId]);
    }

    // Fetch created order
    const { rows: orderRows } = await query(
      `SELECT o.*, t.name AS table_name, w.name AS waiter_name FROM orders o LEFT JOIN tables t ON t.id = o.table_id LEFT JOIN users w ON w.id = o.waiter_id WHERE o.id = ?`,
      [orderId]
    );
    const { rows: itemRows } = await query(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`, [orderId]);

    return NextResponse.json({ ok: true, data: { ...orderRows[0], items: itemRows } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
