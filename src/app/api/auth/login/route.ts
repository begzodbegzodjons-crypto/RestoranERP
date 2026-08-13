import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/serverless-db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';
const JWT_ISSUER = 'restoran-pos-v2';

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ ok: false, code: 'VALIDATION_ERROR', message: 'Telefon va parol kiriting' }, { status: 400 });
    }

    // Find user by phone
    const { rows: users } = await query(
      `SELECT u.id, u.restaurant_id, u.role_id, u.pin_hash, u.password_hash, u.name, u.phone,
              u.is_active, u.failed_attempts, u.locked_until,
              r.name AS role_name, r.display_name AS role_display_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.phone = ? AND u.is_active = 1 AND u.deleted_at IS NULL LIMIT 1`,
      [phone]
    );
    if (users.length === 0) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Noto\'g\'ri telefon yoki parol' }, { status: 401 });
    }
    const user = users[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return NextResponse.json({ ok: false, code: 'ACCOUNT_LOCKED', message: 'Hisob bloklangan' }, { status: 401 });
    }

    // Try password_hash first (admin), then pin_hash (staff)
    let valid = false;
    if (user.password_hash) {
      valid = await bcrypt.compare(password, user.password_hash);
    }
    if (!valid && user.pin_hash) {
      valid = await bcrypt.compare(password, user.pin_hash);
    }

    if (!valid) {
      const newFails = (user.failed_attempts ?? 0) + 1;
      const lockUntil = newFails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await execute(`UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`, [newFails, lockUntil, user.id]);
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Noto\'g\'ri telefon yoki parol' }, { status: 401 });
    }

    await execute(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(3) WHERE id = ?`, [user.id]);

    // Get permissions
    const { rows: permRows } = await query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permRows.map((r: any) => r.code);
    if (user.role_name === 'admin') permissions.push('*');

    const accessToken = jwt.sign(
      { sub: user.id, restaurantId: user.restaurant_id, roleId: user.role_id, roleName: user.role_name, type: 'access' },
      JWT_SECRET, { expiresIn: '15m', issuer: JWT_ISSUER }
    );
    const refreshToken = jwt.sign(
      { sub: user.id, restaurantId: user.restaurant_id, type: 'refresh' },
      JWT_SECRET, { expiresIn: '7d', issuer: JWT_ISSUER }
    );

    await execute(
      `INSERT INTO audit_logs (restaurant_id, user_id, action, entity, entity_id, ip, user_agent, created_at)
       VALUES (?, ?, 'login', 'user', ?, ?, ?, NOW(3))`,
      [user.restaurant_id, user.id, user.id, req.headers.get('x-forwarded-for') || '', req.headers.get('user-agent') || '']
    );

    return NextResponse.json({
      ok: true,
      data: {
        accessToken, refreshToken,
        user: {
          id: user.id, name: user.name, phone: user.phone,
          restaurantId: user.restaurant_id, roleId: user.role_id,
          roleName: user.role_name, roleDisplayName: user.role_display_name,
          permissions,
        }
      }
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, code: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
  }
}
