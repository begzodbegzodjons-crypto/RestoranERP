import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
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
      `SELECT p.id, p.category_id, p.name, p.description, p.sku, p.type, p.unit, p.cost_price,
              p.is_active, p.has_variants, p.sort_order, p.created_at,
              pp.price AS current_price, c.name AS category_name, c.station AS category_station
       FROM products p
       LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.effective_to IS NULL
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.restaurant_id = ? AND p.deleted_at IS NULL
       ORDER BY p.sort_order ASC, p.name ASC`,
      [ctx.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
