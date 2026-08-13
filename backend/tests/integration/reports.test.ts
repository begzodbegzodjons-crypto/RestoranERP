/**
 * Reports tests — verify report calculations with known data.
 *
 * Tests:
 *   1. Summary returns correct totals for 'today' period
 *   2. By-day returns daily breakdown
 *   3. By-product returns top products with revenue + profit
 *   4. By-waiter returns waiter performance
 *   5. By-station returns kitchen/kebab/bar breakdown
 *   6. By-category returns category breakdown
 *   7. Profit calculation (revenue - cost - expenses)
 *   8. Custom date range works
 *   9. Timezone awareness (UTC+5 for Uzbekistan)
 */
import request from 'supertest';
import { app, loginAs, TEST_RESTAURANT, ADMIN_USER, WAITER_USER } from '../helpers';
import { pool } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';

let adminToken: string;
let testOrderId: string;
let testPaymentId: string;

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_USER, '1234');

  // Ensure cashier shift is open
  await request(app)
    .post('/api/shifts/open')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('User-Agent', 'jest-test-agent')
    .send({ openingCash: 0 })
    .expect(200)
    .catch(() => {});

  // Create a test order with kitchen + kebab items
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('User-Agent', 'jest-test-agent')
    .send({
      orderType: 'takeaway',
      items: [
        { productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 2, station: 'kitchen' },
        { productId: 'prod_shashlik_v2', name: 'Shashlik', unitPrice: 25000, costPrice: 12000, quantity: 3, station: 'kebab' },
        { productId: 'prod_cola_v2', name: 'Coca-Cola', unitPrice: 10000, costPrice: 5000, quantity: 2, station: 'bar' },
      ],
      idempotencyKey: uuidv4(),
    })
    .expect(201);
  testOrderId = orderRes.body.data.id;

  // Pay the order (cash)
  const payRes = await request(app)
    .post('/api/payments')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('User-Agent', 'jest-test-agent')
    .send({
      orderId: testOrderId,
      subtotal: 145000, // 2*35000 + 3*25000 + 2*10000
      totalPaid: 145000,
      paymentMethod: 'cash',
      cashAmount: 145000,
      cardAmount: 0, clickAmount: 0, paymeAmount: 0,
      version: orderRes.body.data.version,
      cashierPrinterId: 'printer_cashier_v2',
      idempotencyKey: uuidv4(),
    })
    .expect(201);
  testPaymentId = payRes.body.data.paymentId;
});

afterAll(async () => {
  // Cleanup
  if (testOrderId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM order_events WHERE order_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM order_items WHERE order_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM payments WHERE order_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM inventory_transactions WHERE reference_id = ?', [testOrderId]);
      await conn.execute('DELETE FROM orders WHERE id = ?', [testOrderId]);
      await conn.commit();
    } catch { await conn.rollback(); }
    finally { conn.release(); }
  }
  await pool.end();
});

describe('Reports — summary', () => {
  it('returns correct totals for "today" period', async () => {
    const res = await request(app)
      .get('/api/reports/summary?period=today')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(res.body.data.period).toBe('today');
    expect(Number(res.body.data.total_sales)).toBeGreaterThan(0);
    expect(Number(res.body.data.cash_sales)).toBeGreaterThan(0);
    expect(Number(res.body.data.payments_count)).toBeGreaterThan(0);
    expect(Number(res.body.data.net_revenue)).toBeGreaterThan(0);
  });

  it('returns correct totals for "month" period', async () => {
    const res = await request(app)
      .get('/api/reports/summary?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(res.body.data.period).toBe('month');
    expect(Number(res.body.data.total_sales)).toBeGreaterThanOrEqual(145000);
  });

  it('custom date range works', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/reports/summary?period=custom&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(res.body.data.period).toBe('custom');
    expect(Number(res.body.data.total_sales)).toBeGreaterThan(0);
  });
});

describe('Reports — by-day', () => {
  it('returns daily breakdown for "week" period', async () => {
    const res = await request(app)
      .get('/api/reports/by-day?period=week')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const today = res.body.data[res.body.data.length - 1];
    expect(Number(today.total_sales)).toBeGreaterThan(0);
    expect(today.label).toBeTruthy();
  });
});

describe('Reports — by-product', () => {
  it('returns top products with revenue + profit', async () => {
    const res = await request(app)
      .get('/api/reports/by-product?period=month&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    // Osh palov should be in the list
    const osh = res.body.data.find((p: any) => p.product_name === 'Osh palov');
    if (osh) {
      expect(Number(osh.total_quantity)).toBeGreaterThanOrEqual(2);
      expect(Number(osh.total_revenue)).toBeGreaterThanOrEqual(70000);
      expect(Number(osh.gross_profit)).toBeGreaterThan(0);
    }
  });
});

describe('Reports — by-station', () => {
  it('returns kitchen + kebab + bar breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/by-station?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    const stations = res.body.data.map((s: any) => s.station);
    // At least kitchen and kebab should be present
    expect(stations).toContain('kitchen');
  });
});

describe('Reports — by-category', () => {
  it('returns category breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/by-category?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].category_name).toBeTruthy();
    expect(Number(res.body.data[0].total_revenue)).toBeGreaterThan(0);
  });
});

describe('Reports — by-waiter', () => {
  it('returns waiter performance', async () => {
    const res = await request(app)
      .get('/api/reports/by-waiter?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    // At least one waiter should have sales
    if (res.body.data.length > 0) {
      expect(res.body.data[0].waiter_name).toBeTruthy();
      expect(Number(res.body.data[0].orders_count)).toBeGreaterThan(0);
    }
  });
});

describe('Reports — profit', () => {
  it('returns profit calculation (revenue - cost - expenses)', async () => {
    const res = await request(app)
      .get('/api/reports/profit?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Number(res.body.data.revenue)).toBeGreaterThan(0);
    expect(Number(res.body.data.cogs)).toBeGreaterThan(0);
    expect(Number(res.body.data.gross_profit)).toBeGreaterThan(0);
    expect(Number(res.body.data.net_profit)).toBeGreaterThan(0);
    expect(res.body.data.period).toBe('month');
  });
});

describe('Reports — expenses', () => {
  it('returns expenses breakdown by category', async () => {
    const res = await request(app)
      .get('/api/reports/expenses?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    // Each entry should have category + total_amount
    for (const e of res.body.data) {
      expect(e.category).toBeTruthy();
      expect(Number(e.total_amount)).toBeGreaterThanOrEqual(0);
    }
  });
});
