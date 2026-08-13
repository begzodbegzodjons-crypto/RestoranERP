import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });

    const { rows: orderRows } = await query(
      `SELECT o.*, t.name AS table_name, w.name AS waiter_name, c.name AS cashier_name
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id LEFT JOIN users w ON w.id = o.waiter_id LEFT JOIN users c ON c.id = o.cashier_id
       WHERE o.id = ? AND o.restaurant_id = ? AND o.deleted_at IS NULL`,
      [params.id, payload.restaurantId]
    );
    if (orderRows.length === 0) return NextResponse.json({ ok: false, message: 'Order not found' }, { status: 404 });
    
    const { rows: items } = await query(
      `SELECT oi.*, p.name AS product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.created_at ASC`,
      [params.id]
    );
    return NextResponse.json({ ok: true, data: { ...orderRows[0], items } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
