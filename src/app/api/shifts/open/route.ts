import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function POST(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const body = await req.json();
    
    // Check existing open shift
    const { rows } = await query(
      `SELECT id FROM shifts WHERE restaurant_id = ? AND cashier_id = ? AND status = 'open' LIMIT 1`,
      [payload.restaurantId, payload.sub]
    );
    if (rows.length > 0) return NextResponse.json({ ok: false, code: 'CONFLICT', message: 'Shift already open' }, { status: 409 });
    
    const id = entityId('sft');
    await execute(
      `INSERT INTO shifts (id, restaurant_id, cashier_id, opening_cash, status, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', NOW(3), NOW(3), NOW(3))`,
      [id, payload.restaurantId, payload.sub, body.openingCash ?? 0]
    );
    return NextResponse.json({ ok: true, data: { id, openingCash: body.openingCash ?? 0, status: 'open' } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
