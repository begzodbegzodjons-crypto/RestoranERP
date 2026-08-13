/**
 * Concurrency test for kitchen/kebab screens.
 * Each test creates its own fresh order to avoid state pollution between tests.
 * Validates:
 *   - Parallel reads succeed
 *   - Parallel updates on DIFFERENT items don't conflict
 *   - Station isolation (kitchen updates don't affect kebab queue)
 *   - Cancel doesn't affect other items
 *   - Invalid transitions rejected
 *   - Already-cancelled items can't be updated
 */
import request from 'supertest';
import { app, loginAs, TEST_RESTAURANT, ADMIN_USER } from '../helpers';
import { pool } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';

let adminToken: string;

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_USER, '1234');
});

afterAll(async () => {
  await pool.end();
});

async function createTestOrder(items: Array<{ productId: string; name: string; unitPrice: number; costPrice: number; quantity: number; station: 'kitchen' | 'kebab' | 'bar' }>): Promise<{ orderId: string; itemIds: Record<string, string[]> }> {
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('User-Agent', 'jest-test-agent')
    .send({
      orderType: 'takeaway',
      items,
      idempotencyKey: uuidv4(),
    });
  if (orderRes.status !== 201) {
    throw new Error(`Order creation failed: ${orderRes.status} ${JSON.stringify(orderRes.body)}`);
  }
  // NOTE: We do NOT call /send here — items stay in 'pending' status for testing.
  // /send would mark them as 'cooking' which would invalidate the pending→cooking transition test.

  const itemIds: Record<string, string[]> = { kitchen: [], kebab: [], bar: [] };
  for (const item of orderRes.body.data.items) {
    itemIds[item.station].push(item.id);
  }
  return { orderId: orderRes.body.data.id, itemIds };
}

async function cleanupOrder(orderId: string): Promise<void> {
  if (!orderId) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM order_item_status_history WHERE order_id = ?', [orderId]);
    await conn.execute('DELETE FROM order_events WHERE order_id = ?', [orderId]);
    await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await conn.execute('DELETE FROM print_jobs WHERE order_id = ?', [orderId]);
    await conn.execute('DELETE FROM payments WHERE order_id = ?', [orderId]);
    await conn.execute('DELETE FROM orders WHERE id = ?', [orderId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
  } finally {
    conn.release();
  }
}

const KITCHEN_ITEMS = [
  { productId: 'prod_osh_plov_v2', name: 'Osh palov', unitPrice: 35000, costPrice: 18000, quantity: 1, station: 'kitchen' as const },
  { productId: 'prod_lagmon_v2', name: "Lag'mon", unitPrice: 30000, costPrice: 15000, quantity: 2, station: 'kitchen' as const },
  { productId: 'prod_mastava_v2', name: 'Mastava', unitPrice: 25000, costPrice: 12000, quantity: 1, station: 'kitchen' as const },
  { productId: 'prod_achichuk_v2', name: 'Achichuk', unitPrice: 12000, costPrice: 6000, quantity: 1, station: 'kitchen' as const },
];

const KEBAB_ITEMS = [
  { productId: 'prod_shashlik_v2', name: 'Shashlik', unitPrice: 25000, costPrice: 12000, quantity: 3, station: 'kebab' as const },
  { productId: 'prod_tovuq_v2', name: 'Tovuq kabob', unitPrice: 22000, costPrice: 10000, quantity: 2, station: 'kebab' as const },
  { productId: 'prod_shashlik_v2', name: 'Shashlik', unitPrice: 25000, costPrice: 12000, quantity: 1, station: 'kebab' as const },
  { productId: 'prod_tovuq_v2', name: 'Tovuq kabob', unitPrice: 22000, costPrice: 10000, quantity: 1, station: 'kebab' as const },
];

describe('Concurrency — parallel station access', () => {
  let testOrderId: string;

  afterEach(async () => {
    if (testOrderId) {
      await cleanupOrder(testOrderId);
      testOrderId = '';
    }
  });

  it('two users can read kitchen queue simultaneously', async () => {
    const { orderId } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const [r1, r2] = await Promise.all([
      request(app).get('/api/station/kitchen/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent'),
      request(app).get('/api/station/kitchen/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent'),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(Array.isArray(r1.body.data)).toBe(true);
    expect(Array.isArray(r2.body.data)).toBe(true);
  });

  it('two users can update DIFFERENT kitchen items simultaneously — no conflict', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const item1 = itemIds.kitchen[0];
    const item2 = itemIds.kitchen[1];

    const [r1, r2] = await Promise.all([
      request(app).put(`/api/station/order-items/${item1}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }),
      request(app).put(`/api/station/order-items/${item2}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.data.status).toBe('cooking');
    expect(r2.body.data.status).toBe('cooking');
    expect(r1.body.data.itemId).toBe(item1);
    expect(r2.body.data.itemId).toBe(item2);
  });

  it('kebab updates do NOT affect kitchen queue', async () => {
    const { orderId, itemIds } = await createTestOrder([...KITCHEN_ITEMS, ...KEBAB_ITEMS]);
    testOrderId = orderId;
    const kebabItem = itemIds.kebab[0];

    await request(app).put(`/api/station/order-items/${kebabItem}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }).expect(200);

    const kitchenQueue = await request(app).get('/api/station/kitchen/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    const kebabInKitchen = kitchenQueue.body.data.find((i: any) => i.order_item_id === kebabItem);
    expect(kebabInKitchen).toBeUndefined();
  });

  it('kitchen updates do NOT affect kebab queue', async () => {
    const { orderId, itemIds } = await createTestOrder([...KITCHEN_ITEMS, ...KEBAB_ITEMS]);
    testOrderId = orderId;
    const kitchenItem = itemIds.kitchen[0];

    await request(app).put(`/api/station/order-items/${kitchenItem}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }).expect(200);

    const kebabQueue = await request(app).get('/api/station/kebab/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    const kitchenInKebab = kebabQueue.body.data.find((i: any) => i.order_item_id === kitchenItem);
    expect(kitchenInKebab).toBeUndefined();
  });

  it('cancel one item does NOT affect other items', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const itemToCancel = itemIds.kitchen[3];
    const itemToKeep = itemIds.kitchen[0];

    // Set itemToKeep to cooking first
    await request(app).put(`/api/station/order-items/${itemToKeep}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }).expect(200);

    await request(app).post(`/api/station/order-items/${itemToCancel}/cancel`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ reason: 'Mijoz rad etdi' }).expect(200);

    const queue = await request(app).get('/api/station/kitchen/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    const cancelledStillThere = queue.body.data.find((i: any) => i.order_item_id === itemToCancel);
    expect(cancelledStillThere).toBeUndefined();

    const keptItem = queue.body.data.find((i: any) => i.order_item_id === itemToKeep);
    expect(keptItem).toBeDefined();
    expect(keptItem.status).toBe('cooking');
  });

  it('cancelled item appears in cancelled list', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const itemToCancel = itemIds.kitchen[3];

    await request(app).post(`/api/station/order-items/${itemToCancel}/cancel`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ reason: 'Mijoz rad etdi' }).expect(200);

    const res = await request(app).get('/api/station/kitchen/cancelled').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    const cancelled = res.body.data.find((i: any) => i.order_item_id === itemToCancel);
    expect(cancelled).toBeDefined();
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancel_reason).toBe('Mijoz rad etdi');
  });

  it('invalid status transition rejected', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const item = itemIds.kitchen[0];
    // item is in 'pending' state — try to set to 'served' (invalid)
    await request(app).put(`/api/station/order-items/${item}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'served' }).expect(400);
  });

  it('cannot update already-cancelled item', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const item = itemIds.kitchen[0];
    await request(app).post(`/api/station/order-items/${item}/cancel`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ reason: 'Test' }).expect(200);
    await request(app).put(`/api/station/order-items/${item}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' }).expect(400);
  });

  it('4 parallel kebab status updates — all succeed independently', async () => {
    const { orderId, itemIds } = await createTestOrder(KEBAB_ITEMS);
    testOrderId = orderId;
    const updates = itemIds.kebab.slice(0, 4).map((itemId) =>
      request(app).put(`/api/station/order-items/${itemId}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' })
    );

    const results = await Promise.all(updates);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.data.status).toBe('cooking');
    }
  });

  it('full lifecycle: pending → cooking → ready → served', async () => {
    const { orderId, itemIds } = await createTestOrder(KITCHEN_ITEMS);
    testOrderId = orderId;
    const item = itemIds.kitchen[0];

    // pending → cooking
    const r1 = await request(app).put(`/api/station/order-items/${item}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'cooking' });
    expect(r1.status).toBe(200);
    expect(r1.body.data.status).toBe('cooking');

    // cooking → ready
    const r2 = await request(app).put(`/api/station/order-items/${item}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'ready' });
    expect(r2.status).toBe(200);
    expect(r2.body.data.status).toBe('ready');

    // ready → served
    const r3 = await request(app).put(`/api/station/order-items/${item}/status`).set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent').send({ status: 'served' });
    expect(r3.status).toBe(200);
    expect(r3.body.data.status).toBe('served');

    // Verify served item is NOT in active queue
    const queue = await request(app).get('/api/station/kitchen/queue').set('Authorization', `Bearer ${adminToken}`).set('User-Agent', 'jest-test-agent');
    const servedInQueue = queue.body.data.find((i: any) => i.order_item_id === item);
    expect(servedInQueue).toBeUndefined();
  });
});
