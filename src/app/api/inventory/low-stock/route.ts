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
    const { rows } = await query(
      `SELECT i.id, i.name, i.sku, i.unit, i.stock, i.min_stock, i.cost,
              (i.min_stock - i.stock) AS shortage,
              CASE WHEN i.stock <= 0 THEN 'out' WHEN i.stock < i.min_stock/2 THEN 'critical' WHEN i.stock < i.min_stock THEN 'low' ELSE 'ok' END AS alert_level,
              s.name AS supplier_name
       FROM inventory i LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.restaurant_id = ? AND i.is_active = 1 AND i.deleted_at IS NULL AND i.stock < i.min_stock`,
      [payload.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
