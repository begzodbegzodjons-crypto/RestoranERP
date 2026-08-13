import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId } from '@/lib/serverless-db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const { rows } = await query(
      `SELECT u.id, u.name, u.phone, u.role_id, r.name AS role_name, r.display_name AS role_display_name, u.is_active, u.last_login_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.restaurant_id = ? AND u.deleted_at IS NULL ORDER BY u.name ASC`,
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
    const { name, phone, pin, roleName } = await req.json();
    
    if (!name || !phone || !pin) {
      return NextResponse.json({ ok: false, message: 'Ism, telefon va PIN majburiy' }, { status: 400 });
    }

    // Find or create role
    const { rows: existingRoles } = await query(
      `SELECT id FROM roles WHERE restaurant_id = ? AND name = ? LIMIT 1`,
      [payload.restaurantId, roleName || 'waiter']
    );
    let roleId;
    if (existingRoles.length > 0) {
      roleId = existingRoles[0].id;
    } else {
      roleId = entityId('rol');
      await execute(
        `INSERT INTO roles (id, restaurant_id, name, display_name, is_system, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, NOW(3), NOW(3))`,
        [roleId, payload.restaurantId, roleName || 'waiter', roleName || 'Ofitsiant']
      );
    }

    const id = entityId('usr');
    const hash = await bcrypt.hash(pin, 10);
    await execute(
      `INSERT INTO users (id, restaurant_id, role_id, name, phone, pin_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, payload.restaurantId, roleId, name, phone, hash]
    );

    return NextResponse.json({ ok: true, data: { id, name, phone, roleName } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
