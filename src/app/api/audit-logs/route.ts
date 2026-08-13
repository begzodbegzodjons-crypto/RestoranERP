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
      `SELECT a.id, a.restaurant_id, a.user_id, u.name AS user_name, u.phone AS user_phone,
              a.action, a.entity, a.entity_id, a.ip, a.user_agent, a.before, a.after, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.restaurant_id = ? ORDER BY a.created_at DESC LIMIT 200`,
      [payload.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
