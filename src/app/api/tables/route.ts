import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

function getCtx(req: NextRequest): { userId: string; restaurantId: string; permissions: string[] } | null {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    return { userId: payload.sub, restaurantId: payload.restaurantId, permissions: [] };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = getCtx(req);
    if (!ctx) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });

    const { rows } = await query(
      `SELECT * FROM v_tables_with_status WHERE restaurant_id = ? ORDER BY sort_order ASC, name ASC`,
      [ctx.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
