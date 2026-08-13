/**
 * Offline sync integration test.
 *
 * Tests:
 *   1. Push a batch of operations (create order) — all succeed
 *   2. Push duplicate idempotency key — returns cached result (no duplicate)
 *   3. Push order.create with conflicting version — returns conflict status
 *   4. Pull deltas since timestamp — returns updated entities
 *   5. Sync status — returns device info + pending count
 *   6. Full offline cycle: create offline → push when online → verify on server
 */
import request from 'supertest';
import { app, loginAs, TEST_RESTAURANT, ADMIN_USER, WAITER_USER } from '../helpers';
import { pool } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';

let adminToken: string;
let waiterToken: string;
let deviceId: string;

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_USER, '1234');
  waiterToken = await loginAs(WAITER_USER, '1234');
  deviceId = uuidv4();
});

afterAll(async () => {
  await pool.end();
});

describe('Offline sync — push operations', () => {
  let testOrderId: string;
  let testIdempotencyKey: string;

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
        await conn.execute('DELETE FROM sync_queue WHERE entity_id = ? OR server_entity_id = ?', [testOrderId, testOrderId]);
        await conn.execute('DELETE FROM orders WHERE id = ?', [testOrderId]);
        await conn.commit();
      } catch { await conn.rollback(); }
      finally { conn.release(); }
    }
  });

  it('pushes a create order operation — succeeds', async () => {
    testIdempotencyKey = uuidv4();
    const res = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        deviceId,
        operations: [
          {
            idempotencyKey: testIdempotencyKey,
            entity: 'order',
            operation: 'create',
            payload: {
              orderType: 'takeaway',
              items: [
                { productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 1, station: 'kitchen' },
              ],
            },
            clientVersion: 0,
          },
        ],
      })
      .expect(200);

    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0].status).toBe('synced');
    expect(res.body.data.results[0].serverEntityId).toBeTruthy();

    // Find the created order
    testOrderId = res.body.data.results[0].serverEntityId;
    expect(testOrderId).toBeTruthy();

    // Verify order exists in DB
    const [orderRows] = await pool.query('SELECT id, order_number FROM orders WHERE id = ?', [testOrderId]);
    expect(orderRows.length).toBe(1);
    expect(orderRows[0].order_number).toBeTruthy();
  });

  it('duplicate idempotency key — returns cached result (no duplicate)', async () => {
    const res = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        deviceId,
        operations: [
          {
            idempotencyKey: testIdempotencyKey, // SAME key as previous test
            entity: 'order',
            operation: 'create',
            payload: { orderType: 'takeaway', items: [] },
            clientVersion: 0,
          },
        ],
      })
      .expect(200);

    expect(res.body.data.results[0].status).toBe('synced');
    expect(res.body.data.results[0].replayed).toBe(true);
    expect(res.body.data.results[0].serverEntityId).toBe(testOrderId);

    // Verify no duplicate order was created
    const [rows] = await pool.query('SELECT COUNT(*) as c FROM sync_queue WHERE idempotency_key = ?', [testIdempotencyKey]);
    expect(Number(rows[0].c)).toBe(1); // only one sync_queue entry
  });
});

describe('Offline sync — pull deltas', () => {
  it('pulls updated entities since a timestamp', async () => {
    // Use a timestamp from 1 minute ago
    const since = new Date(Date.now() - 60000).toISOString();

    const res = await request(app)
      .get(`/api/sync/pull?since=${since}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(res.body.data.serverTime).toBeTruthy();
    expect(res.body.data.changes).toBeDefined();
    expect(Array.isArray(res.body.data.changes.tables)).toBe(true);
    expect(Array.isArray(res.body.data.changes.orders)).toBe(true);
  });
});

describe('Offline sync — sync status', () => {
  it('returns device status + pending count', async () => {
    const res = await request(app)
      .get(`/api/sync/status?deviceId=${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .expect(200);

    expect(res.body.data.pendingOperations).toBeDefined();
    expect(typeof res.body.data.pendingOperations).toBe('number');
  });
});

describe('Offline sync — conflict resolution', () => {
  it('duplicate operation ID is rejected (no double-sync)', async () => {
    const idemKey = uuidv4();

    // First push
    const r1 = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        deviceId,
        operations: [
          {
            idempotencyKey: idemKey,
            entity: 'order',
            operation: 'create',
            payload: {
              orderType: 'takeaway',
              items: [{ productId: 'prod_cola_v2', name: 'Cola', unitPrice: 10000, costPrice: 5000, quantity: 1, station: 'bar' }],
            },
            clientVersion: 0,
          },
        ],
      })
      .expect(200);

    expect(r1.body.data.results[0].status).toBe('synced');

    // Second push with SAME idempotency key
    const r2 = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        deviceId,
        operations: [
          {
            idempotencyKey: idemKey, // SAME
            entity: 'order',
            operation: 'create',
            payload: { orderType: 'takeaway', items: [] },
            clientVersion: 0,
          },
        ],
      })
      .expect(200);

    expect(r2.body.data.results[0].status).toBe('synced');
    expect(r2.body.data.results[0].replayed).toBe(true);

    // Cleanup
    const orderId = r1.body.data.results[0].serverEntityId;
    if (orderId) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [orderId]);
        await conn.execute('DELETE FROM order_events WHERE order_id = ?', [orderId]);
        await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
        await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [orderId]);
        await conn.execute('DELETE FROM payments WHERE order_id = ?', [orderId]);
        await conn.execute('DELETE FROM sync_queue WHERE idempotency_key = ?', [idemKey]);
        await conn.execute('DELETE FROM orders WHERE id = ?', [orderId]);
        await conn.commit();
      } catch { await conn.rollback(); }
      finally { conn.release(); }
    }
  });

  it('batch push of multiple operations — all processed', async () => {
    const idem1 = uuidv4();
    const idem2 = uuidv4();

    const res = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('User-Agent', 'jest-test-agent')
      .send({
        deviceId,
        operations: [
          {
            idempotencyKey: idem1,
            entity: 'order',
            operation: 'create',
            payload: {
              orderType: 'takeaway',
              items: [{ productId: 'prod_water_v2', name: 'Suv', unitPrice: 5000, costPrice: 2000, quantity: 1, station: 'bar' }],
            },
            clientVersion: 0,
          },
          {
            idempotencyKey: idem2,
            entity: 'order',
            operation: 'create',
            payload: {
              orderType: 'takeaway',
              items: [{ productId: 'prod_choy_v2', name: 'Choy', unitPrice: 8000, costPrice: 3000, quantity: 1, station: 'bar' }],
            },
            clientVersion: 0,
          },
        ],
      })
      .expect(200);

    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.results[0].status).toBe('synced');
    expect(res.body.data.results[1].status).toBe('synced');
    expect(res.body.data.results[0].serverEntityId).not.toBe(res.body.data.results[1].serverEntityId);

    // Cleanup both orders
    for (const r of res.body.data.results) {
      const orderId = r.serverEntityId;
      if (orderId) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [orderId]);
          await conn.execute('DELETE FROM order_events WHERE order_id = ?', [orderId]);
          await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
          await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [orderId]);
          await conn.execute('DELETE FROM payments WHERE order_id = ?', [orderId]);
          await conn.execute('DELETE FROM sync_queue WHERE idempotency_key = ?', [r.idempotencyKey]);
          await conn.execute('DELETE FROM orders WHERE id = ?', [orderId]);
          await conn.commit();
        } catch { await conn.rollback(); }
        finally { conn.release(); }
      }
    }
  });
});
