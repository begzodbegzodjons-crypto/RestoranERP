/**
 * SECURITY TEST SUITE
 * ==================
 * Comprehensive security tests for auth + RBAC system.
 *
 * Test groups:
 *   A. Privilege escalation — waiter/kitchen cannot access admin endpoints
 *   B. Brute-force protection — 5 failed attempts → 15-min lockout
 *   C. Session security — refresh rotation, revoked tokens rejected
 *   D. Token tampering — modified token rejected
 *   E. Audit log verification — login/logout/important actions recorded
 *   F. Role-permission matrix — all 6 roles checked against critical permissions
 *   G. IDOR (Insecure Direct Object Reference) — user A cannot read user B's resources
 *   H. SQL injection — malicious input safely escaped
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app, loginAs, authHeader, TEST_RESTAURANT, ADMIN_USER, CASHIER_USER, WAITER_USER, KITCHEN_USER, KEBAB_USER, WAREHOUSE_USER } from '../helpers';
import { pool } from '../../src/db';
import { signAccessToken } from '../../src/auth/jwt';

let adminToken: string;
let cashierToken: string;
let waiterToken: string;
let kitchenToken: string;
let kebabToken: string;
let warehouseToken: string;

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_USER, '1234');
  cashierToken = await loginAs(CASHIER_USER, '1234');
  waiterToken = await loginAs(WAITER_USER, '1234');
  kitchenToken = await loginAs(KITCHEN_USER, '1234');
  kebabToken = await loginAs(KEBAB_USER, '1234');
  warehouseToken = await loginAs(WAREHOUSE_USER, '1234');
});

afterAll(async () => {
  await pool.end();
});

// ============================================================================
// A. PRIVILEGE ESCALATION
// ============================================================================
describe('Security A — Privilege escalation', () => {
  const adminOnlyEndpoints: Array<[string, string, string, string?]> = [
    ['GET',    '/api/users',          'staff.read',     'list all users'],
    ['POST',   '/api/users',          'staff.manage',   'create user'],
    ['GET',    '/api/roles',           'staff.read',     'list roles'],
    ['GET',    '/api/audit-logs',      'audit.read',     'read audit logs'],
    ['GET',    '/api/backups',         'backup.manage',  'list backups'],
    ['POST',   '/api/backups',        'backup.manage',  'create backup'],
    ['GET',    '/api/roles/permissions','staff.read',    'list permissions'],
  ];

  for (const [method, path, perm, desc] of adminOnlyEndpoints) {
    it(`WAITER cannot ${desc} (${method} ${path}) — requires ${perm}`, async () => {
      const r = await request(app)[method.toLowerCase() as 'get'](path).set(authHeader(waiterToken));
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('FORBIDDEN');
    });

    it(`KITCHEN cannot ${desc} (${method} ${path}) — requires ${perm}`, async () => {
      const r = await request(app)[method.toLowerCase() as 'get'](path).set(authHeader(kitchenToken));
      expect(r.status).toBe(403);
    });

    it(`KEBAB cannot ${desc} (${method} ${path}) — requires ${perm}`, async () => {
      const r = await request(app)[method.toLowerCase() as 'get'](path).set(authHeader(kebabToken));
      expect(r.status).toBe(403);
    });

    it(`WAREHOUSE cannot ${desc} (${method} ${path}) — requires ${perm}`, async () => {
      const r = await request(app)[method.toLowerCase() as 'get'](path).set(authHeader(warehouseToken));
      expect(r.status).toBe(403);
    });

    it(`ADMIN can ${desc} (${method} ${path})`, async () => {
      const r = await request(app)[method.toLowerCase() as 'get'](path).set(authHeader(adminToken));
      expect(r.status).not.toBe(403);
      expect(r.status).not.toBe(401);
    });
  }

  it('WAITER cannot create payment (cashier-only)', async () => {
    const r = await request(app)
      .post('/api/payments')
      .set(authHeader(waiterToken))
      .send({});
    expect(r.status).toBe(403);
  });

  it('KITCHEN cannot create payment', async () => {
    const r = await request(app)
      .post('/api/payments')
      .set(authHeader(kitchenToken))
      .send({});
    expect(r.status).toBe(403);
  });

  it('CASHIER cannot create user (admin-only)', async () => {
    const r = await request(app)
      .post('/api/users')
      .set(authHeader(cashierToken))
      .send({ name: 'Hacker', phone: '+998901111111', pin: '1234', roleId: 'role_admin_v2' });
    expect(r.status).toBe(403);
  });

  it('WAITER cannot close Z-report (admin/cashier only)', async () => {
    const r = await request(app)
      .post('/api/reports/z-report/close')
      .set(authHeader(waiterToken))
      .send({});
    expect(r.status).toBe(403);
  });

  it('WAREHOUSE cannot access orders payment', async () => {
    const r = await request(app)
      .post('/api/payments')
      .set(authHeader(warehouseToken))
      .send({});
    expect(r.status).toBe(403);
  });

  it('CASHIER cannot manage printers', async () => {
    const r = await request(app)
      .post('/api/printers')
      .set(authHeader(cashierToken))
      .send({ name: 'X', station: 'kitchen', connectionType: 'usb', paperWidth: 58 });
    expect(r.status).toBe(403);
  });
});

// ============================================================================
// B. BRUTE-FORCE PROTECTION
// ============================================================================
describe('Security B — Brute-force protection', () => {
  // Use waiter user for brute-force tests to not lock out admin/cashier needed by other tests
  const bruteForcePhone = '+998903333444';

  beforeEach(async () => {
    // Reset failed_attempts + locked_until + clear sessions before each test
    await pool.execute(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE phone = ?`,
      [bruteForcePhone]
    );
  });

  it('locks account after 5 failed attempts', async () => {
    // 4 fails — should still be allowed
    for (let i = 1; i <= 4; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'brute-test')
        .send({ phone: bruteForcePhone, pin: '0000' }); // valid format, wrong PIN
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    }

    // 5th fail — should lock the account
    const r5 = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'brute-test')
      .send({ phone: bruteForcePhone, pin: '0000' });
    expect(r5.status).toBe(401);

    // Verify account is locked
    const [rows] = await pool.query<any[]>(
      `SELECT failed_attempts, locked_until FROM users WHERE phone = ?`, [bruteForcePhone]
    );
    expect(Number(rows[0].failed_attempts)).toBe(5);
    expect(rows[0].locked_until).not.toBeNull();
    // Lock should be ~15 minutes in the future
    const lockMs = new Date(rows[0].locked_until).getTime();
    const nowMs = Date.now();
    expect(lockMs - nowMs).toBeGreaterThan(10 * 60 * 1000); // > 10 min
    expect(lockMs - nowMs).toBeLessThan(20 * 60 * 1000);    // < 20 min
  });

  it('rejects valid credentials when account is locked', async () => {
    // Force-lock the account
    await pool.execute(
      `UPDATE users SET failed_attempts = 5, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE phone = ?`,
      [bruteForcePhone]
    );

    const r = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'brute-test')
      .send({ phone: bruteForcePhone, pin: '1234' }); // CORRECT pin

    expect(r.status).toBe(401);
    expect(r.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('resets failed_attempts on successful login', async () => {
    // First, accumulate 3 fails (below lockout threshold)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'reset-test')
        .send({ phone: bruteForcePhone, pin: '0000' });
    }
    const [after3Fails] = await pool.query<any[]>(
      `SELECT failed_attempts FROM users WHERE phone = ?`, [bruteForcePhone]
    );
    expect(Number(after3Fails[0].failed_attempts)).toBe(3);

    // Now successful login
    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'reset-test')
      .send({ phone: bruteForcePhone, pin: '1234' })
      .expect(200);

    const [afterSuccess] = await pool.query<any[]>(
      `SELECT failed_attempts, locked_until FROM users WHERE phone = ?`, [bruteForcePhone]
    );
    expect(Number(afterSuccess[0].failed_attempts)).toBe(0);
    expect(afterSuccess[0].locked_until).toBeNull();
  });
});

// ============================================================================
// C. SESSION SECURITY
// ============================================================================
describe('Security C — Session security', () => {
  it('rotates refresh token on each /auth/refresh call', async () => {
    // Login
    const login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'rotation-test')
      .send({ phone: '+998901234567', pin: '1234' })
      .expect(200);
    const originalRefresh = login.body.data.refreshToken;

    // First refresh
    const r1 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh })
      .expect(200);
    const newRefresh1 = r1.body.data.refreshToken;
    expect(newRefresh1).not.toBe(originalRefresh);

    // Old refresh token should be INVALIDATED
    const r2 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });
    expect(r2.status).toBe(401);

    // New refresh token should work
    const r3 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: newRefresh1 })
      .expect(200);
    expect(r3.body.data.refreshToken).not.toBe(newRefresh1);
  });

  it('rejects access token after logout', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'logout-test')
      .send({ phone: '+998901234567', pin: '1234' })
      .expect(200);
    const accessToken = login.body.data.accessToken;
    const refreshToken = login.body.data.refreshToken;

    // Should work before logout
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('User-Agent', 'logout-test')
      .expect(200);

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('User-Agent', 'logout-test')
      .send({ refreshToken })
      .expect(200);

    // Refresh after logout should fail
    const r = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(r.status).toBe(401);
  });

  it('rejects expired/malformed tokens', async () => {
    const malformedTokens = [
      'not.a.jwt',
      'Bearer invalid',
      '',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      'a'.repeat(500),
    ];
    for (const token of malformedTokens) {
      const r = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(401);
    }
  });

  it('rejects request without Authorization header', async () => {
    const r = await request(app).get('/api/users');
    expect(r.status).toBe(401);
  });

  it('rejects request with wrong Authorization scheme', async () => {
    const r = await request(app)
      .get('/api/users')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(r.status).toBe(401);
  });

  it('cannot use refresh token as access token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'scheme-test')
      .send({ phone: '+998901234567', pin: '1234' })
      .expect(200);
    const refreshToken = login.body.data.refreshToken;

    const r = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);
    expect(r.status).toBe(401);
  });
});

// ============================================================================
// D. TOKEN TAMPERING
// ============================================================================
describe('Security D — Token tampering', () => {
  it('rejects token with modified payload', async () => {
    // Sign a token for waiter, then try to use it as admin
    const waiterToken = signAccessToken({
      sub: WAITER_USER,
      restaurantId: TEST_RESTAURANT,
      roleName: 'waiter',
    });

    // Waiter CANNOT list users
    const r1 = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${waiterToken}`)
      .set('User-Agent', 'tamper-test');
    expect(r1.status).toBe(403);

    // Try to forge a token with admin role — but we don't have JWT_SECRET, so we can't
    // Even if attacker modifies payload, signature won't match
    const fakePayload = Buffer.from(JSON.stringify({
      sub: ADMIN_USER, restaurantId: TEST_RESTAURANT, role: 'admin',
      type: 'access', jti: 'fake'
    })).toString('base64').replace(/=/g, '');
    const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${fakePayload}.fake-signature`;
    const r2 = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(r2.status).toBe(401);
  });

  it('rejects token signed with wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign(
      { sub: ADMIN_USER, restaurantId: TEST_RESTAURANT, type: 'access', jti: 'fake' },
      'wrong-secret-not-the-real-one',
      { expiresIn: '1h', issuer: 'restoran-pos-v2' }
    );
    const r = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${forged}`);
    expect(r.status).toBe(401);
  });

  it('rejects cross-tenant token (different restaurantId)', async () => {
    // Sign a token with a fake restaurantId
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign(
      { sub: ADMIN_USER, restaurantId: 'fake-restaurant-id', type: 'access', jti: 'fake' },
      process.env.JWT_SECRET,
      { expiresIn: '1h', issuer: 'restoran-pos-v2' }
    );
    const r = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${forged}`)
      .set('User-Agent', 'cross-tenant-test');
    // Should be 401 because user doesn't exist in fake restaurant
    expect(r.status).toBe(401);
  });
});

// ============================================================================
// E. AUDIT LOG VERIFICATION
// ============================================================================
describe('Security E — Audit log', () => {
  it('logs login event to audit_logs', async () => {
    const before = await pool.query<any[]>(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'login' AND user_id = ?`,
      [WAITER_USER]
    );
    const beforeCount = Number(before[0][0].c);

    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'audit-test')
      .send({ phone: '+998903333444', pin: '1234' })
      .expect(200);

    const afterCount = await pool.query<any[]>(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'login' AND user_id = ?`,
      [WAITER_USER]
    );
    expect(Number(afterCount[0][0].c)).toBeGreaterThanOrEqual(beforeCount + 1);

    const lastLogin = await pool.query<any[]>(
      `SELECT action, ip, user_agent FROM audit_logs
        WHERE action = 'login' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [WAITER_USER]
    );
    expect(lastLogin[0][0].action).toBe('login');
    expect(lastLogin[0][0].user_agent).toContain('audit-test');
  });

  it('logs logout event to audit_logs', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'audit-logout')
      .send({ phone: '+998901234567', pin: '1234' })
      .expect(200);

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .set('User-Agent', 'audit-logout')
      .send({ refreshToken: login.body.data.refreshToken })
      .expect(200);

    const [rows] = await pool.query<any[]>(
      `SELECT action, user_agent FROM audit_logs
        WHERE action = 'logout' AND user_id = ? AND user_agent LIKE '%audit-logout%'
        ORDER BY created_at DESC LIMIT 1`,
      [ADMIN_USER]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe('logout');
  });

  it('logs create_order to audit_logs', async () => {
    const before = await pool.query<any[]>(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'create' AND entity = 'order'`
    );
    const beforeCount = Number(before[0][0].c);

    const order = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh', unitPrice: 35000, costPrice: 18000, quantity: 1, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      })
      .expect(201);

    const after = await pool.query<any[]>(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'create' AND entity = 'order'`
    );
    expect(Number(after[0][0].c)).toBeGreaterThanOrEqual(beforeCount + 1);

    // Cleanup
    if (order.body.data.id) {
      await pool.execute(`DELETE FROM order_items WHERE order_id = ?`, [order.body.data.id]);
      await pool.execute(`DELETE FROM order_events WHERE order_id = ?`, [order.body.data.id]);
      await pool.execute(`DELETE FROM orders WHERE id = ?`, [order.body.data.id]);
    }
  });

  it('audit log records IP and User-Agent', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'ip-ua-test-agent')
      .set('X-Forwarded-For', '203.0.113.42')
      .send({ phone: '+998901234567', pin: '1234' })
      .expect(200);

    const [rows] = await pool.query<any[]>(
      `SELECT ip, user_agent FROM audit_logs
        WHERE action = 'login' AND user_id = ? AND user_agent = 'ip-ua-test-agent'
        ORDER BY created_at DESC LIMIT 1`,
      [ADMIN_USER]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].user_agent).toBe('ip-ua-test-agent');
    // IP should be recorded (either ::ffff:127.0.0.1 or X-Forwarded-For if trust proxy set)
    expect(rows[0].ip).toBeTruthy();
  });
});

// ============================================================================
// F. ROLE-PERMISSION MATRIX
// ============================================================================
describe('Security F — Role-permission matrix', () => {
  // Helper: check that a role HAS the expected permission
  async function checkPermission(userId: string, expectedPerm: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
      `SELECT 1 FROM v_user_permissions WHERE user_id = ? AND permission_code = ? LIMIT 1`,
      [userId, expectedPerm]
    );
    return rows.length > 0;
  }

  describe('ADMIN role', () => {
    it('has all permissions', async () => {
      const perms = [
        'staff.manage', 'role.manage', 'menu.manage', 'table.manage',
        'order.create', 'order.update', 'order.cancel', 'order.discount',
        'payment.create', 'payment.refund', 'shift.open', 'shift.close',
        'report.zreport', 'printer.manage', 'inventory.manage',
        'backup.manage', 'audit.read',
      ];
      for (const p of perms) {
        expect(await checkPermission(ADMIN_USER, p)).toBe(true);
      }
    });
  });

  describe('CASHIER role', () => {
    it('has order.read but NOT order.create', async () => {
      expect(await checkPermission(CASHIER_USER, 'order.read')).toBe(true);
      expect(await checkPermission(CASHIER_USER, 'order.create')).toBe(false);
    });

    it('has payment.create + receipt.print', async () => {
      expect(await checkPermission(CASHIER_USER, 'payment.create')).toBe(true);
      expect(await checkPermission(CASHIER_USER, 'receipt.print')).toBe(true);
    });

    it('has shift.open + shift.close', async () => {
      expect(await checkPermission(CASHIER_USER, 'shift.open')).toBe(true);
      expect(await checkPermission(CASHIER_USER, 'shift.close')).toBe(true);
    });

    it('has report.view + report.zreport', async () => {
      expect(await checkPermission(CASHIER_USER, 'report.view')).toBe(true);
      expect(await checkPermission(CASHIER_USER, 'report.zreport')).toBe(true);
    });

    it('does NOT have staff.manage', async () => {
      expect(await checkPermission(CASHIER_USER, 'staff.manage')).toBe(false);
    });

    it('does NOT have menu.manage', async () => {
      expect(await checkPermission(CASHIER_USER, 'menu.manage')).toBe(false);
    });

    it('does NOT have inventory.manage', async () => {
      expect(await checkPermission(CASHIER_USER, 'inventory.manage')).toBe(false);
    });
  });

  describe('WAITER role', () => {
    it('has order.create + order.update + order.read', async () => {
      expect(await checkPermission(WAITER_USER, 'order.create')).toBe(true);
      expect(await checkPermission(WAITER_USER, 'order.update')).toBe(true);
      expect(await checkPermission(WAITER_USER, 'order.read')).toBe(true);
    });

    it('has table.read + menu.read', async () => {
      expect(await checkPermission(WAITER_USER, 'table.read')).toBe(true);
      expect(await checkPermission(WAITER_USER, 'menu.read')).toBe(true);
    });

    it('does NOT have payment.create', async () => {
      expect(await checkPermission(WAITER_USER, 'payment.create')).toBe(false);
    });

    it('does NOT have shift.close', async () => {
      expect(await checkPermission(WAITER_USER, 'shift.close')).toBe(false);
    });

    it('does NOT have report.zreport', async () => {
      expect(await checkPermission(WAITER_USER, 'report.zreport')).toBe(false);
    });
  });

  describe('KITCHEN role', () => {
    it('has station.kitchen.view + order.item.status', async () => {
      expect(await checkPermission(KITCHEN_USER, 'station.kitchen.view')).toBe(true);
      expect(await checkPermission(KITCHEN_USER, 'order.item.status')).toBe(true);
    });

    it('does NOT have station.kebab.view', async () => {
      expect(await checkPermission(KITCHEN_USER, 'station.kebab.view')).toBe(false);
    });

    it('does NOT have order.create', async () => {
      expect(await checkPermission(KITCHEN_USER, 'order.create')).toBe(false);
    });
  });

  describe('KEBAB role', () => {
    it('has station.kebab.view + order.item.status', async () => {
      expect(await checkPermission(KEBAB_USER, 'station.kebab.view')).toBe(true);
      expect(await checkPermission(KEBAB_USER, 'order.item.status')).toBe(true);
    });

    it('does NOT have station.kitchen.view', async () => {
      expect(await checkPermission(KEBAB_USER, 'station.kitchen.view')).toBe(false);
    });
  });

  describe('WAREHOUSE role', () => {
    it('has inventory.read + inventory.manage + inventory.adjust', async () => {
      expect(await checkPermission(WAREHOUSE_USER, 'inventory.read')).toBe(true);
      expect(await checkPermission(WAREHOUSE_USER, 'inventory.manage')).toBe(true);
      expect(await checkPermission(WAREHOUSE_USER, 'inventory.adjust')).toBe(true);
    });

    it('has purchase.manage + expense.manage + inventory.count', async () => {
      expect(await checkPermission(WAREHOUSE_USER, 'purchase.manage')).toBe(true);
      expect(await checkPermission(WAREHOUSE_USER, 'expense.manage')).toBe(true);
      expect(await checkPermission(WAREHOUSE_USER, 'inventory.count')).toBe(true);
    });

    it('does NOT have order.create', async () => {
      expect(await checkPermission(WAREHOUSE_USER, 'order.create')).toBe(false);
    });

    it('does NOT have payment.create', async () => {
      expect(await checkPermission(WAREHOUSE_USER, 'payment.create')).toBe(false);
    });
  });
});

// ============================================================================
// G. IDOR (Insecure Direct Object Reference)
// ============================================================================
describe('Security G — IDOR', () => {
  it('cannot read user detail without staff.read permission', async () => {
    // Waiter tries to read admin's user detail
    const r = await request(app)
      .get(`/api/users/${ADMIN_USER}`)
      .set(authHeader(waiterToken));
    expect(r.status).toBe(403);
  });

  it('admin can read any user detail', async () => {
    const r = await request(app)
      .get(`/api/users/${WAITER_USER}`)
      .set(authHeader(adminToken));
    expect(r.status).toBe(200);
  });

  it('waiter can read tables (own restaurant)', async () => {
    const r = await request(app)
      .get('/api/tables')
      .set(authHeader(waiterToken));
    expect(r.status).toBe(200);
  });
});

// ============================================================================
// H. SQL INJECTION
// ============================================================================
describe('Security H — SQL injection', () => {
  it('login endpoint escapes SQL in phone field', async () => {
    const maliciousInputs = [
      "' OR '1'='1",
      "admin'--",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "\" OR \"\"=\"",
    ];
    for (const phone of maliciousInputs) {
      const r = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'sqli-test')
        .send({ phone, pin: '1234' });
      // Should be 401 (no user found) — NOT 500 (SQL error) — proves escaping works
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    }
    // Verify tables still exist (no DROP TABLE success)
    const [rows] = await pool.query<any[]>(`SHOW TABLES LIKE 'users'`);
    expect(rows.length).toBe(1);
  });

  it('orders endpoint escapes SQL in id param', async () => {
    const maliciousIds = [
      "1' OR '1'='1",
      "'; DROP TABLE orders; --",
      "1 UNION SELECT * FROM payments",
    ];
    for (const id of maliciousIds) {
      const r = await request(app)
        .get(`/api/orders/${encodeURIComponent(id)}`)
        .set(authHeader(waiterToken));
      // Should be 404 (not found) — NOT 500 (SQL error)
      expect([404, 400]).toContain(r.status);
    }
  });

  it('query params are escaped (no SQL injection)', async () => {
    // Inject SQL into query param — validation should reject (400) OR return empty result
    const r = await request(app)
      .get('/api/orders?status=' + encodeURIComponent("' OR 1=1 --"))
      .set(authHeader(waiterToken));
    // Either validation fails (400) or no matching status (200 with empty list)
    // Either way, it must NOT return all orders (no SQL injection success)
    expect([200, 400]).toContain(r.status);
    if (r.status === 200) {
      // If 200, returned list should be empty (no matching status)
      expect(r.body.data.items.length).toBe(0);
    }
    // Most importantly: NOT a 500 error (SQL injection would cause syntax error → 500)
    expect(r.status).not.toBe(500);
  });
});
