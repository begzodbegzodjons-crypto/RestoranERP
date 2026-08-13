import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const { rows } = await query(
      `SELECT p.id, p.category_id, p.name, p.description, p.type, p.unit, p.cost_price, p.is_active, p.sort_order,
              pp.price AS current_price, c.name AS category_name, c.station AS category_station
       FROM products p
       LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.effective_to IS NULL
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.restaurant_id = ? AND p.deleted_at IS NULL ORDER BY p.sort_order, p.name`,
      [payload.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const { name, categoryId, price, type, unit, costPrice } = await req.json();
    
    if (!name || !price) {
      return NextResponse.json({ ok: false, message: 'Nomi va narx majburiy' }, { status: 400 });
    }

    const id = entityId('prod');
    await execute(
      `INSERT INTO products (id, restaurant_id, category_id, name, type, unit, cost_price, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(3), NOW(3))`,
      [id, payload.restaurantId, categoryId ?? null, name, type ?? 'kitchen', unit ?? 'piece', costPrice ?? 0]
    );
    // Insert initial price
    await execute(
      `INSERT INTO product_prices (id, product_id, price, currency, effective_from, created_at)
       VALUES (?, ?, ?, 'UZS', NOW(3), NOW(3))`,
      [entityId('pp'), id, price]
    );
    
    return NextResponse.json({ ok: true, data: { id, name, price } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
