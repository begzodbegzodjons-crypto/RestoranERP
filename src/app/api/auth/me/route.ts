import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';
const JWT_ISSUER = 'restoran-pos-v2';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: JWT_ISSUER });
    if (payload.type !== 'access') return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });

    const { rows: userRows } = await query(
      `SELECT u.id, u.name, u.phone, u.restaurant_id, u.role_id, r.name AS role_name, r.display_name AS role_display_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = 1 AND u.deleted_at IS NULL`,
      [payload.sub]
    );
    if (userRows.length === 0) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const u = userRows[0];

    // Get permissions directly (not via view)
    const { rows: permRows } = await query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
      [u.role_id]
    );
    const permissions = permRows.map((r: any) => r.code);
    if (u.role_name === 'admin') permissions.push('*');

    return NextResponse.json({
      ok: true,
      data: {
        id: u.id, name: u.name, phone: u.phone,
        restaurantId: u.restaurant_id, roleId: u.role_id,
        roleName: u.role_name, roleDisplayName: u.role_display_name,
        permissions,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Invalid token' }, { status: 401 });
  }
}
