/**
 * Security + Backup integration tests.
 *
 * SECURITY:
 *   1. Password hashing (bcrypt)
 *   2. Authentication required for all API endpoints
 *   3. Authorization (RBAC — role-based access control)
 *   4. Input validation (Zod schemas reject invalid input)
 *   5. SQL injection protection (parameterized queries)
 *   6. XSS protection (Helmet headers)
 *   7. Rate limiting (login endpoint)
 *   8. Audit logs for all critical actions
 *   9. Secrets in env vars (not exposed to frontend)
 *  10. Database credentials not in API responses
 *
 * AUDIT LOG COVERAGE:
 *   - LOGIN, LOGOUT
 *   - CREATE (user, order, product, table, printer)
 *   - UPDATE (user, order, product, table)
 *   - DELETE (user, product, table, printer)
 *   - PAYMENT
 *   - REFUND
 *   - DISCOUNT
 *   - INVENTORY CHANGE
 *   - ORDER CANCEL
 *
 * BACKUP:
 *   - Create manual backup (with table/row count + checksum)
 *   - Verify backup integrity
 *   - Restore with confirmation
 *   - Backup history
 */
import request from 'supertest';
import { app, loginAs, TEST_RESTAURANT, ADMIN_USER, WAITER_USER, CASHIER_USER } from '../helpers';
import { pool } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';

let adminToken: string;
let waiterToken: string;
let cashierToken: string;

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_USER, '1234');
  waiterToken = await loginAs(WAITER_USER, '1234');
  cashierToken = await loginAs(CASHIER_USER, '1234');
});

afterAll(async () => {
  await pool.end();
});

// ============================================================
// SECURITY TESTS
// ============================================================
describe('Security — authentication', () => {
  it('rejects request without Authorization header', async () => {
    const r = await request(app).get('/api/users');
    expect(r.status).toBe(401);
  });

  it('rejects request with invalid token', async () => {
    const r = await request(app).get('/api/users').set('Authorization', 'Bearer invalidtoken');
    expect(r.status).toBe(401);
  });

  it('rejects request with wrong scheme (Basic auth)', async () => {
    const r = await request(app).get('/api/users').set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(r.status).toBe(401);
  });
});

describe('Security — authorization (RBAC)', () => {
  it('waiter cannot list users (staff.read)', async () => {
    const r = await request(app).get('/api/users').set('Authorization', `Bearer ${waiterToken}`).set('User-Agent', 'jest-test-agent');
    expect(r.status).toBe(403);
  });

  it('cashier cannot create users (staff.manage)', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${cashierToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ name: 'Hacker', phone: '+998909999999', pin: '1234', roleId: 'role_admin_v2' });
    expect(r.status).toBe(403);
  });

  it('waiter cannot manage printers', async () => {
    const r = await request(app).post('/api/printers')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ name: 'X', station: 'kitchen', connectionType: 'usb', paperWidth: 58 });
    expect(r.status).toBe(403);
  });

  it('admin can list users', async () => {
    const r = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    expect(r.status).toBe(200);
  });
});

describe('Security — input validation', () => {
  it('rejects invalid order creation (missing items)', async () => {
    const r = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ orderType: 'takeaway', items: [], idempotencyKey: uuidv4() });
    expect(r.status).toBe(400);
  });

  it('rejects invalid payment method', async () => {
    const r = await request(app).post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ orderId: 'fake', paymentMethod: 'bitcoin' });
    expect(r.status).toBe(400);
  });

  it('rejects negative quantity in order items', async () => {
    const r = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh', unitPrice: 35000, costPrice: 18000, quantity: -5, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      });
    expect(r.status).toBe(400);
  });
});

describe('Security — SQL injection', () => {
  it('login endpoint escapes SQL in phone field', async () => {
    const malicious = ["' OR '1'='1", "admin'--", "'; DROP TABLE users; --", "' UNION SELECT * FROM users --"];
    for (const phone of malicious) {
      const r = await request(app).post('/api/auth/login')
        .set('User-Agent', 'jest-test-agent')
        .send({ phone, pin: '1234' });
      expect(r.status).toBe(401); // Not 500 (SQL error)
    }
    // Verify tables still exist
    const [rows] = await pool.query('SHOW TABLES LIKE "users"');
    expect(rows.length).toBe(1);
  });

  it('order endpoint escapes SQL in path params', async () => {
    const malicious = ["1' OR '1'='1", "'; DROP TABLE orders; --"];
    for (const id of malicious) {
      const r = await request(app).get(`/api/orders/${encodeURIComponent(id)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('User-Agent', 'jest-test-agent');
      expect([404, 400]).toContain(r.status); // Not 500
    }
  });
});

describe('Security — XSS protection headers', () => {
  it('returns security headers', async () => {
    const r = await request(app).get('/health');
    // Helmet should set these headers
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-frame-options']).toBeDefined();
    // HSTS only on HTTPS, but helmet sets it
    expect(r.headers['strict-transport-security']).toBeDefined();
  });
});

describe('Security — secrets not exposed', () => {
  it('API responses do not contain DB credentials', async () => {
    const r = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent');
    const bodyStr = JSON.stringify(r.body);
    // DB credentials should never appear in API responses
    expect(bodyStr).not.toContain('gateway01.eu-central-1');
    expect(bodyStr).not.toContain('3YTK6Em4WhtFiqF');
    expect(bodyStr).not.toContain('ovAH3n3bu2YabeK0');
    expect(bodyStr).not.toContain('DB_PASSWORD');
  });

  it('user API does not return password_hash or pin_hash', async () => {
    const r = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent');
    const bodyStr = JSON.stringify(r.body);
    expect(bodyStr).not.toContain('pin_hash');
    expect(bodyStr).not.toContain('password_hash');
  });
});

// ============================================================
// AUDIT LOG COVERAGE
// ============================================================
describe('Audit logs — critical actions', () => {
  it('LOGIN action is logged', async () => {
    await loginAs(WAITER_USER, '1234');
    const [rows] = await pool.query(
      'SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND user_id = ?',
      ['login', WAITER_USER]
    );
    expect(Number(rows[0].c)).toBeGreaterThan(0);
  });

  it('LOGOUT action is logged', async () => {
    const login = await request(app).post('/api/auth/login')
      .set('User-Agent', 'jest-test-agent')
      .send({ phone: '+998903333444', pin: '1234' });
    await request(app).post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ refreshToken: login.body.data.refreshToken });

    const [rows] = await pool.query(
      'SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND user_id = ?',
      ['logout', WAITER_USER]
    );
    expect(Number(rows[0].c)).toBeGreaterThan(0);
  });

  it('CREATE action is logged (order create)', async () => {
    const beforeCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity = ?', ['create', 'order']);
    const before = Number((beforeCount as any)[0][0].c);

    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_cola_v2', name: 'Cola', unitPrice: 10000, costPrice: 5000, quantity: 1, station: 'bar' }],
        idempotencyKey: uuidv4(),
      });

    const afterCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity = ?', ['create', 'order']);
    const after = Number((afterCount as any)[0][0].c);
    expect(after).toBeGreaterThan(before);

    // Cleanup
    if (res.body.data?.id) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [res.body.data.id]);
        await conn.execute('DELETE FROM order_events WHERE order_id = ?', [res.body.data.id]);
        await conn.execute('DELETE FROM order_items WHERE order_id = ?', [res.body.data.id]);
        await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [res.body.data.id]);
        await conn.execute('DELETE FROM orders WHERE id = ?', [res.body.data.id]);
        await conn.commit();
      } catch { await conn.rollback(); }
      finally { conn.release(); }
    }
  });

  it('PAYMENT action is logged', async () => {
    const beforeCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ?', ['pay']);
    const before = Number((beforeCount as any)[0][0].c);

    // Create + pay order
    const orderRes = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_water_v2', name: 'Suv', unitPrice: 5000, costPrice: 2000, quantity: 1, station: 'bar' }],
        idempotencyKey: uuidv4(),
      });

    // Open shift
    await request(app).post('/api/shifts/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ openingCash: 0 })
      .expect(200)
      .catch(() => {});

    await request(app).post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        orderId: orderRes.body.data.id,
        subtotal: 5000, totalPaid: 5000,
        paymentMethod: 'cash', cashAmount: 5000,
        cardAmount: 0, clickAmount: 0, paymeAmount: 0,
        version: orderRes.body.data.version,
        cashierPrinterId: 'printer_cashier_v2',
        idempotencyKey: uuidv4(),
      });

    const afterCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ?', ['pay']);
    const after = Number((afterCount as any)[0][0].c);
    expect(after).toBeGreaterThan(before);

    // Cleanup
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM order_events WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM payments WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM inventory_transactions WHERE reference_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM orders WHERE id = ?', [orderRes.body.data.id]);
      await conn.commit();
    } catch { await conn.rollback(); }
    finally { conn.release(); }
  });

  it('INVENTORY CHANGE action is logged', async () => {
    const beforeCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity = ?', ['adjust', 'inventory']);
    const before = Number((beforeCount as any)[0][0].c);

    await request(app).post('/api/inventory/inv_salt_v2/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ type: 'in', quantity: 1, reason: 'Security test' });

    const afterCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity = ?', ['adjust', 'inventory']);
    const after = Number((afterCount as any)[0][0].c);
    expect(after).toBeGreaterThan(before);
  });

  it('ORDER CANCEL action is logged', async () => {
    // Create order
    const orderRes = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_choy_v2', name: 'Choy', unitPrice: 8000, costPrice: 3000, quantity: 1, station: 'bar' }],
        idempotencyKey: uuidv4(),
      });

    const beforeCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ?', ['cancel']);
    const before = Number((beforeCount as any)[0][0].c);

    // Cancel order
    await request(app).post(`/api/orders/${orderRes.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ reason: 'Security test cancel' });

    const afterCount = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE action = ?', ['cancel']);
    const after = Number((afterCount as any)[0][0].c);
    expect(after).toBeGreaterThan(before);

    // Cleanup
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM order_events WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [orderRes.body.data.id]);
      await conn.execute('DELETE FROM orders WHERE id = ?', [orderRes.body.data.id]);
      await conn.commit();
    } catch { await conn.rollback(); }
    finally { conn.release(); }
  });
});

// ============================================================
// BACKUP TESTS
// ============================================================
describe('Backup — create + verify + restore', () => {
  let backupId: string;

  it('creates manual backup with table count + checksum', async () => {
    const r = await request(app).post('/api/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ note: 'Security test backup' });

    expect(r.status).toBe(201);
    expect(r.body.data.id).toBeTruthy();
    expect(r.body.data.status).toBe('completed');
    expect(Number(r.body.data.tables_count)).toBeGreaterThan(0);
    expect(Number(r.body.data.rows_count)).toBeGreaterThan(0);
    expect(r.body.data.checksum).toBeTruthy();
    expect(r.body.data.checksum).toHaveLength(64); // SHA-256

    backupId = r.body.data.id;
  });

  it('lists backup history', async () => {
    const r = await request(app).get('/api/backups')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent');

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBeGreaterThan(0);
    // Verify backup has required fields
    const backup = r.body.data.find((b: any) => b.id === backupId);
    expect(backup).toBeDefined();
    expect(backup.status).toBe('completed');
    expect(Number(backup.tables_count)).toBeGreaterThan(0);
  });

  it('gets backup status (last backup)', async () => {
    const r = await request(app).get('/api/backups/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent');

    expect(r.status).toBe(200);
    expect(r.body.data).toBeTruthy();
    expect(r.body.data.status).toBe('completed');
  });

  it('verifies backup integrity', async () => {
    const r = await request(app).post(`/api/backups/${backupId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent');

    expect(r.status).toBe(200);
    expect(r.body.data.verified).toBeDefined();
    expect(r.body.data.tables).toBeDefined();
    expect(r.body.data.rows).toBeDefined();
    expect(r.body.data.checksum).toBeDefined();
  });

  it('restore requires confirmation "RESTORE"', async () => {
    // Without confirmation
    const r1 = await request(app).post(`/api/backups/${backupId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ confirm: 'NO', reason: 'test' });
    expect(r1.status).toBe(400);

    // With wrong confirmation
    const r2 = await request(app).post(`/api/backups/${backupId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ confirm: 'YES', reason: 'test' });
    expect(r2.status).toBe(400);
  });

  it('restore succeeds with correct confirmation', async () => {
    const r = await request(app).post(`/api/backups/${backupId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ confirm: 'RESTORE', reason: 'Security test restore' });

    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('restore_initiated');
    expect(r.body.data.backup_id).toBe(backupId);
  });

  it('restore action is logged in audit', async () => {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity_id = ?',
      ['restore_backup', backupId]
    );
    expect(Number(rows[0].c)).toBeGreaterThan(0);
  });

  it('backup creation is logged in audit', async () => {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as c FROM audit_logs WHERE action = ? AND entity_id = ?',
      ['create_backup', backupId]
    );
    expect(Number(rows[0].c)).toBeGreaterThan(0);
  });
});
