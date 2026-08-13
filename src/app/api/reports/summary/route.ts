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
      `SELECT * FROM v_today_sales WHERE restaurant_id = ?`, [payload.restaurantId]
    );
    const s = rows[0] ?? { payments_count: 0, total_sales: 0, cash_sales: 0, card_sales: 0, click_sales: 0, payme_sales: 0, tips: 0, discounts: 0, change_given: 0 };
    return NextResponse.json({ ok: true, data: s });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
