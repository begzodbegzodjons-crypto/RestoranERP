/**
 * Test helpers — login, create test orders, etc.
 */
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/auth/jwt';
import request from 'supertest';

export const TEST_RESTAURANT = 'cmrfyb8acl714dvcf0000v2';
export const ADMIN_USER = 'user_admin_v2';
export const CASHIER_USER = 'user_cashier_v2';
export const WAITER_USER = 'user_waiter_v2';
export const KITCHEN_USER = 'user_kitchen_v2';
export const KEBAB_USER = 'user_kebab_v2';

export const app = createApp();

export async function setPin(userId: string, pin: string): Promise<void> {
  const hash = await hashPassword(pin);
  await pool.execute(
    `UPDATE users SET pin_hash = ?, is_active = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?`,
    [hash, userId]
  );
}

export async function login(phone: string, pin: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'jest-test-agent')
    .send({ phone, pin })
    .expect(200);
  return { accessToken: res.body.data.accessToken, refreshToken: res.body.data.refreshToken };
}

export async function loginAs(userId: string, pin = '1234'): Promise<string> {
  // Look up user's phone
  const [rows] = await pool.query<any[]>(
    `SELECT phone FROM users WHERE id = ?`, [userId]
  );
  if (rows.length === 0) throw new Error(`User ${userId} not found`);
  await setPin(userId, pin);
  const { accessToken } = await login(rows[0].phone, pin);
  return accessToken;
}

export function authHeader(token: string): { Authorization: string; 'User-Agent': string } {
  return { Authorization: `Bearer ${token}`, 'User-Agent': 'jest-test-agent' };
}

export function cuid(prefix: string): string {
  if (prefix.length > 5) prefix = prefix.slice(0, 5);
  const { randomBytes } = require('crypto');
  const hex = randomBytes(14).toString('hex');
  return `${prefix}_${hex}`.slice(0, 28);
}

export function uuidv4(): string {
  return require('uuid').v4();
}

/** Clean up test data — call after each test to avoid pollution. */
export async function cleanupOrder(orderId: string): Promise<void> {
  if (!orderId) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM order_item_status_history WHERE order_id = ?`, [orderId]);
    await conn.execute(`DELETE FROM order_events WHERE order_id = ?`, [orderId]);
    await conn.execute(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
    await conn.execute(`DELETE FROM print_jobs WHERE order_id = ?`, [orderId]);
    await conn.execute(`DELETE FROM payments WHERE order_id = ?`, [orderId]);
    await conn.execute(`DELETE FROM orders WHERE id = ?`, [orderId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
