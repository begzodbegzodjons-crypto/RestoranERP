import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId } from '@/lib/serverless-db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';
const JWT_ISSUER = 'restoran-pos-v2';

export async function POST(req: NextRequest) {
  try {
    const { restaurantName, phone, password } = await req.json();
    if (!restaurantName || !phone || !password) {
      return NextResponse.json({ ok: false, message: 'Barcha maydonlar majburiy' }, { status: 400 });
    }

    const { rows: existing } = await query(`SELECT id FROM users WHERE phone = ? AND is_active = 1 LIMIT 1`, [phone]);
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, message: 'Bu telefon allaqachon ro\'yxatdan o\'tgan' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const restaurantId = entityId('rst');
    const adminRoleId = entityId('rol');
    const adminUserId = entityId('usr');

    // Create restaurant
    await execute(
      `INSERT INTO restaurants (id, name, currency, tax_rate, timezone, is_active, created_at, updated_at)
       VALUES (?, ?, 'UZS', 0, 'Asia/Tashkent', 1, NOW(3), NOW(3))`,
      [restaurantId, restaurantName]
    );

    // Create admin role
    await execute(
      `INSERT INTO roles (id, restaurant_id, name, display_name, description, is_system, created_at, updated_at)
       VALUES (?, ?, 'admin', 'Administrator', 'Toliq boshqaruv', 1, NOW(3), NOW(3))`,
      [adminRoleId, restaurantId]
    );

    // Create admin user
    await execute(
      `INSERT INTO users (id, restaurant_id, role_id, name, phone, password_hash, pin_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'Administrator', ?, ?, ?, 1, NOW(3), NOW(3))`,
      [adminUserId, restaurantId, adminRoleId, phone, hash, hash]
    );

    // Grant all permissions in one query
    await execute(
      `INSERT INTO role_permissions (role_id, permission_id, created_at)
       SELECT ?, id, NOW(3) FROM permissions`,
      [adminRoleId]
    );

    // Create 3 categories
    for (const [name, station, sort] of [['Osh va taomlar', 'kitchen', 1], ['Kaboblar', 'kebab', 2], ['Ichimliklar', 'bar', 3]] as any) {
      await execute(
        `INSERT INTO categories (id, restaurant_id, name, station, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
        [entityId('cat'), restaurantId, name, station, sort]
      );
    }

    // Create 5 tables
    for (let i = 1; i <= 5; i++) {
      await execute(
        `INSERT INTO tables (id, restaurant_id, name, capacity, section, status, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 4, 'Asosiy zal', 'free', ?, 1, NOW(3), NOW(3))`,
        [entityId('tbl'), restaurantId, `Stol ${i}`, i]
      );
    }

    // Create 2 printers
    for (const [name, station, usb] of [['Oshxona printeri', 'kitchen', 'XP-58'], ['Kassir printeri', 'cashier', 'XP-80']] as any) {
      const pid = entityId('prn');
      await execute(
        `INSERT INTO printers (id, restaurant_id, name, station, connection_type, usb_name, paper_width, charset, retry_count, timeout_ms, enabled, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'usb', ?, 58, 'cp866', 3, 5000, 1, 1, NOW(3), NOW(3))`,
        [pid, restaurantId, name, station, usb]
      );
      await execute(
        `INSERT INTO printer_routes (id, restaurant_id, printer_id, source_type, station, event, priority, is_active, created_at)
         VALUES (?, ?, ?, 'station', ?, 'order', 10, 1, NOW(3))`,
        [entityId('prt'), restaurantId, pid, station]
      );
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { sub: adminUserId, restaurantId, roleId: adminRoleId, roleName: 'admin', type: 'access' },
      JWT_SECRET, { expiresIn: '15m', issuer: JWT_ISSUER }
    );
    const refreshToken = jwt.sign(
      { sub: adminUserId, restaurantId, type: 'refresh' },
      JWT_SECRET, { expiresIn: '7d', issuer: JWT_ISSUER }
    );

    return NextResponse.json({
      ok: true,
      data: {
        accessToken, refreshToken,
        user: {
          id: adminUserId, name: 'Administrator', phone,
          restaurantId, roleId: adminRoleId,
          roleName: 'admin', roleDisplayName: 'Administrator',
          permissions: ['*'],
        }
      }
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
