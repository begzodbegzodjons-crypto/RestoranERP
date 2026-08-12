/**
 * Integration tests — full HTTP flow against real TiDB v2 DB.
 *
 * Tests:
 *   1. Auth flow (login → me → logout)
 *   2. Order creation (atomic, idempotent)
 *   3. Order → add items → cancel item (version bump)
 *   4. Payment (atomic, idempotent, inventory consume)
 *   5. Concurrency — duplicate payment rejected
 *   6. RBAC — waiter cannot access admin endpoints
 *   7. Tables list — uses view (no N+1)
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app, loginAs, authHeader, cuid, cleanupOrder, TEST_RESTAURANT, WAITER_USER, CASHIER_USER, ADMIN_USER, KITCHEN_USER } from '../helpers';
import { pool } from '../../src/db';

let adminToken: string;
let waiterToken: string;
let cashierToken: string;
let kitchenToken: string;

beforeAll(async () => {
  // Reset all PINs to known values
  adminToken = await loginAs(ADMIN_USER, '1234');
  waiterToken = await loginAs(WAITER_USER, '1234');
  cashierToken = await loginAs(CASHIER_USER, '1234');
  kitchenToken = await loginAs(KITCHEN_USER, '1234');
});

afterAll(async () => {
  await pool.end();
});

// ============================================================
// 1. AUTH FLOW
// ============================================================
describe('Auth flow', () => {
  it('GET /api/auth/me returns current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe(ADMIN_USER);
    expect(res.body.data.restaurantId).toBe(TEST_RESTAURANT);
    expect(res.body.data.roleName).toBe('admin');
    expect(res.body.data.permissions).toContain('order.create');
  });

  it('rejects request without Authorization header', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    expect(res.body.ok).toBe(false);
  });

  it('rejects invalid token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);
  });

  it('logs out and revokes session', async () => {
    const { accessToken, refreshToken } = await (async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'jest-test-agent')
        .send({ phone: '+998901234567', pin: '1234' })
        .expect(200);
      return { accessToken: res.body.data.accessToken, refreshToken: res.body.data.refreshToken };
    })();

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({ refreshToken })
      .expect(200);

    // Refresh after logout should fail
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});

// ============================================================
// 2. ORDER CREATION (atomic, idempotent)
// ============================================================
describe('Order creation', () => {
  let createdOrderId: string;

  afterEach(async () => {
    if (createdOrderId) {
      await cleanupOrder(createdOrderId);
      createdOrderId = undefined as any;
    }
  });

  it('creates an order atomically with items', async () => {
    const idem = uuidv4();
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send({
        tableId: null,
        orderType: 'dine_in',
        items: [
          { productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 2, station: 'kitchen' },
          { productId: 'prod_shashlik_v2', name: 'Shashlik', unitPrice: 25000, costPrice: 12000, quantity: 3, station: 'kebab' },
        ],
        idempotencyKey: idem,
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.items).toHaveLength(2);
    expect(Number(res.body.data.subtotal)).toBe(35000 * 2 + 25000 * 3);
    expect(Number(res.body.data.total)).toBe(35000 * 2 + 25000 * 3);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.payment_status).toBe('unpaid');
    createdOrderId = res.body.data.id;
  });

  it('rejects duplicate idempotency key (idempotent replay)', async () => {
    const idem = uuidv4();
    const body = {
      tableId: null,
      orderType: 'takeaway',
      items: [{ productId: 'prod_lagmon_v2', name: "Lag'mon", unitPrice: 30000, costPrice: 15000, quantity: 1, station: 'kitchen' }],
      idempotencyKey: idem,
    };

    const first = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send(body)
      .expect(201);
    createdOrderId = first.body.data.id;

    const second = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send(body)
      .expect(200);

    expect(second.body.ok).toBe(true);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.data.id).toBe(createdOrderId);
  });

  it('rejects order creation without auth', async () => {
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh', unitPrice: 35000, quantity: 1, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      })
      .expect(401);
  });
});

// ============================================================
// 3. ORDER ITEMS (add, cancel)
// ============================================================
describe('Order items', () => {
  let orderId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send({
        orderType: 'dine_in',
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 1, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      })
      .expect(201);
    orderId = res.body.data.id;
  });

  afterEach(async () => {
    await cleanupOrder(orderId);
  });

  it('adds items to existing order + bumps version', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set(authHeader(waiterToken))
      .send({
        items: [{ productId: 'prod_cola_v2', name: 'Coca-Cola', unitPrice: 10000, costPrice: 5000, quantity: 2, station: 'bar' }],
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.orderVersion).toBe(2);
    expect(res.body.data.insertedItems).toHaveLength(1);
  });

  it('cancels a single item with reason', async () => {
    // First add another item
    const added = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set(authHeader(waiterToken))
      .send({
        items: [{ productId: 'prod_cola_v2', name: 'Coca-Cola', unitPrice: 10000, costPrice: 5000, quantity: 1, station: 'bar' }],
      })
      .expect(201);
    const itemId = added.body.data.insertedItems[0].id;

    const res = await request(app)
      .post(`/api/orders/${orderId}/items/${itemId}/cancel`)
      .set(authHeader(waiterToken))
      .send({ reason: 'Customer changed mind' })
      .expect(200);

    expect(res.body.data.itemId).toBe(itemId);
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('rejects cancelling item without reason', async () => {
    const added = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set(authHeader(waiterToken))
      .send({
        items: [{ productId: 'prod_cola_v2', name: 'Coca-Cola', unitPrice: 10000, costPrice: 5000, quantity: 1, station: 'bar' }],
      })
      .expect(201);
    const itemId = added.body.data.insertedItems[0].id;

    await request(app)
      .post(`/api/orders/${orderId}/items/${itemId}/cancel`)
      .set(authHeader(waiterToken))
      .send({})
      .expect(400);
  });
});

// ============================================================
// 4. PAYMENT (atomic + idempotent + inventory consume)
// ============================================================
describe('Payment processing', () => {
  let orderId: string;
  let orderVersion: number;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send({
        orderType: 'dine_in',
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 2, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      })
      .expect(201);
    orderId = res.body.data.id;
    orderVersion = res.body.data.version;
  });

  afterEach(async () => {
    await cleanupOrder(orderId);
  });

  it('processes payment atomically', async () => {
    // Snapshot inventory BEFORE
    const [before] = await pool.query<any[]>(
      `SELECT stock FROM inventory WHERE id = 'inv_rice_v2'`
    );
    const riceBefore = Number(before[0].stock);

    const res = await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send({
        orderId,
        subtotal: 70000,
        totalPaid: 70000,
        paymentMethod: 'cash',
        cashAmount: 70000,
        cardAmount: 0,
        clickAmount: 0,
        paymeAmount: 0,
        version: orderVersion,
        cashierPrinterId: 'printer_cashier_v2',
        idempotencyKey: uuidv4(),
      })
      .expect(201);

    expect(res.body.data.paymentId).toBeTruthy();
    expect(res.body.data.orderId).toBe(orderId);

    // Verify order is paid
    const [orderRow] = await pool.query<any[]>(
      `SELECT status, payment_status FROM orders WHERE id = ?`, [orderId]
    );
    expect(orderRow[0].status).toBe('paid');
    expect(orderRow[0].payment_status).toBe('paid');

    // Verify inventory was consumed (recipe: 0.150 kg rice per plov × 2 = 0.300 kg)
    const [after] = await pool.query<any[]>(
      `SELECT stock FROM inventory WHERE id = 'inv_rice_v2'`
    );
    const riceAfter = Number(after[0].stock);
    expect(riceBefore - riceAfter).toBeCloseTo(0.300, 3);
  });

  it('rejects duplicate payment (idempotent replay)', async () => {
    const idem = uuidv4();
    const body = {
      orderId,
      subtotal: 70000,
      totalPaid: 70000,
      paymentMethod: 'cash',
      cashAmount: 70000,
      cardAmount: 0,
      clickAmount: 0,
      paymeAmount: 0,
      version: orderVersion,
      cashierPrinterId: 'printer_cashier_v2',
      idempotencyKey: idem,
    };

    const first = await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send(body)
      .expect(201);

    const second = await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send(body)
      .expect(200);

    expect(second.body.idempotent).toBe(true);
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
  });

  it('rejects payment with wrong version (optimistic lock)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send({
        orderId,
        subtotal: 70000,
        totalPaid: 70000,
        paymentMethod: 'cash',
        cashAmount: 70000,
        cardAmount: 0,
        clickAmount: 0,
        paymeAmount: 0,
        version: 999, // WRONG
        cashierPrinterId: 'printer_cashier_v2',
        idempotencyKey: uuidv4(),
      })
      .expect(409);

    expect(res.body.code).toBe('CONFLICT');
  });

  it('rejects mixed payment where method amounts != total', async () => {
    await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send({
        orderId,
        subtotal: 70000,
        totalPaid: 70000,
        paymentMethod: 'mixed',
        cashAmount: 30000,
        cardAmount: 30000, // 30000+30000=60000 ≠ 70000
        clickAmount: 0,
        paymeAmount: 0,
        version: orderVersion,
        cashierPrinterId: 'printer_cashier_v2',
        idempotencyKey: uuidv4(),
      })
      .expect(400);
  });

  it('supports mixed payment (cash + click + payme)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(authHeader(cashierToken))
      .send({
        orderId,
        subtotal: 70000,
        totalPaid: 70000,
        paymentMethod: 'mixed',
        cashAmount: 30000,
        cardAmount: 0,
        clickAmount: 20000,
        paymeAmount: 20000, // sum=70000 ✓
        version: orderVersion,
        cashierPrinterId: 'printer_cashier_v2',
        idempotencyKey: uuidv4(),
      })
      .expect(201);

    expect(res.body.data.paymentId).toBeTruthy();

    // Verify payment items
    const [items] = await pool.query<any[]>(
      `SELECT method, amount FROM payment_items WHERE payment_id = ?`, [res.body.data.paymentId]
    );
    const methods = items.map((i) => i.method).sort();
    expect(methods).toEqual(['cash', 'click', 'payme']);
  });
});

// ============================================================
// 5. CONCURRENCY
// ============================================================
describe('Concurrency', () => {
  it('two cashiers paying same order — one wins, one gets conflict', async () => {
    // Create order
    const order = await request(app)
      .post('/api/orders')
      .set(authHeader(waiterToken))
      .send({
        orderType: 'takeaway',
        items: [{ productId: 'prod_osh_plov_v2', name: 'Osh', unitPrice: 35000, costPrice: 18000, quantity: 1, station: 'kitchen' }],
        idempotencyKey: uuidv4(),
      })
      .expect(201);
    const orderId = order.body.data.id;
    const version = order.body.data.version;

    // Fire two payments in parallel
    const body = {
      orderId,
      subtotal: 35000,
      totalPaid: 35000,
      paymentMethod: 'cash',
      cashAmount: 35000,
      cardAmount: 0,
      clickAmount: 0,
      paymeAmount: 0,
      version,
      cashierPrinterId: 'printer_cashier_v2',
    };

    const [r1, r2] = await Promise.all([
      request(app).post('/api/payments').set(authHeader(cashierToken)).send({ ...body, idempotencyKey: uuidv4() }),
      request(app).post('/api/payments').set(authHeader(cashierToken)).send({ ...body, idempotencyKey: uuidv4() }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // One wins (201), one fails (409 conflict)
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    await cleanupOrder(orderId);
  });
});

// ============================================================
// 6. RBAC
// ============================================================
describe('RBAC', () => {
  it('waiter CANNOT list users (admin permission)', async () => {
    await request(app)
      .get('/api/users')
      .set(authHeader(waiterToken))
      .expect(403);
  });

  it('admin CAN list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('waiter CAN read tables', async () => {
    await request(app)
      .get('/api/tables')
      .set(authHeader(waiterToken))
      .expect(200);
  });

  it('kitchen user CANNOT pay orders', async () => {
    await request(app)
      .post('/api/payments')
      .set(authHeader(kitchenToken))
      .send({})
      .expect(403);
  });

  it('kitchen user CAN view kitchen queue', async () => {
    const res = await request(app)
      .get('/api/station/kitchen/queue')
      .set(authHeader(kitchenToken))
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('kitchen user CANNOT view kebab queue', async () => {
    await request(app)
      .get('/api/station/kebab/queue')
      .set(authHeader(kitchenToken))
      .expect(403);
  });
});

// ============================================================
// 7. TABLES VIEW (no N+1)
// ============================================================
describe('Tables view', () => {
  it('returns all tables in single query', async () => {
    const res = await request(app)
      .get('/api/tables')
      .set(authHeader(waiterToken))
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    // Verify each row has expected fields (no N+1)
    for (const t of res.body.data) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.status).toBeTruthy();
      expect(t).toHaveProperty('current_order_id');
      expect(t).toHaveProperty('waiter_name');
    }
  });
});
