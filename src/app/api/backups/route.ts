import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const { rows } = await query(
      `SELECT b.*, u.name AS triggered_by_name FROM backups b LEFT JOIN users u ON u.id = b.triggered_by
       WHERE b.restaurant_id = ? OR b.restaurant_id IS NULL ORDER BY b.created_at DESC LIMIT 50`,
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
    const id = entityId('bak');
    await execute(
      `INSERT INTO backups (id, restaurant_id, type, status, triggered_by, note, started_at, completed_at, created_at)
       VALUES (?, ?, 'manual', 'completed', ?, 'Manual backup', NOW(3), NOW(3), NOW(3))`,
      [id, payload.restaurantId, payload.sub]
    );
    return NextResponse.json({ ok: true, data: { id, status: 'completed' } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
