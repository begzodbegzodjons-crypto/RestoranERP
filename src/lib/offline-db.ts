/**
 * Offline database — IndexedDB via Dexie.
 *
 * Stores:
 *   - kv          : key-value store (session, device_id, last_sync_at)
 *   - tables      : cached restaurant tables
 *   - categories  : cached menu categories
 *   - products    : cached menu products
 *   - my_orders   : waiter's own orders (for offline viewing)
 *   - queue       : pending offline operations (UUID, created_at, device_id, type, payload, status, retry_count)
 */
import Dexie, { Table } from 'dexie';

export interface QueueItem {
  uuid: string;           // unique operation ID
  created_at: number;      // timestamp
  device_id: string;       // device UUID
  operation_type: string;  // 'order.create' | 'order.add_items' | 'order.cancel_item'
  entity: string;          // 'order' | 'order_item'
  entity_id?: string;      // local entity ID (for reference)
  payload: any;            // operation data
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  retry_count: number;
  last_error?: string;
  synced_at?: number;
  server_entity_id?: string;
}

export interface CachedTable {
  id: string;
  name: string;
  capacity: number;
  section: string | null;
  status: string;
  current_order_id: string | null;
  current_order_number: string | null;
  current_order_total: number | null;
  waiter_name: string | null;
  current_order_items: number;
  cached_at: number;
}

export interface CachedProduct {
  id: string;
  name: string;
  category_id: string | null;
  current_price: number;
  type: string;
  unit: string;
  cost_price: number;
  cached_at: number;
}

export interface CachedCategory {
  id: string;
  name: string;
  station: string;
  sort_order: number;
  cached_at: number;
}

export interface KV {
  key: string;
  value: any;
}

class OfflineDB extends Dexie {
  kv!: Table<KV, string>;
  tables_cache!: Table<CachedTable, string>;
  categories_cache!: Table<CachedCategory, string>;
  products_cache!: Table<CachedProduct, string>;
  queue!: Table<QueueItem, string>;

  constructor() {
    super('RestoranPOS');
    this.version(1).stores({
      kv: 'key',
      tables_cache: 'id, status, cached_at',
      categories_cache: 'id, station, cached_at',
      products_cache: 'id, type, cached_at',
      queue: 'uuid, status, created_at, device_id, operation_type',
    });
  }
}

// Singleton — only create in browser
let dbInstance: OfflineDB | null = null;

export function getDB(): OfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB only available in browser');
  }
  if (!dbInstance) {
    dbInstance = new OfflineDB();
  }
  return dbInstance;
}

// Helper: get or create device ID
export async function getDeviceId(): Promise<string> {
  const db = getDB();
  let kv = await db.kv.get('device_id');
  if (!kv) {
    const id = crypto.randomUUID();
    await db.kv.put({ key: 'device_id', value: id });
    return id;
  }
  return kv.value;
}

// Helper: cache tables
export async function cacheTables(tables: any[]): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.tables_cache.clear();
  await db.tables_cache.bulkPut(
    tables.map(t => ({
      id: t.id,
      name: t.name,
      capacity: Number(t.capacity),
      section: t.section,
      status: t.status,
      current_order_id: t.current_order_id,
      current_order_number: t.current_order_number,
      current_order_total: t.current_order_total ? Number(t.current_order_total) : null,
      waiter_name: t.waiter_name,
      current_order_items: Number(t.current_order_items ?? 0),
      cached_at: now,
    }))
  );
}

// Helper: cache products + categories
export async function cacheMenu(products: any[], categories: any[]): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.products_cache.clear();
  await db.categories_cache.clear();
  await db.products_cache.bulkPut(
    products.map(p => ({
      id: p.id,
      name: p.name,
      category_id: p.category_id ?? p.category_id,
      current_price: Number(p.current_price ?? 0),
      type: p.type,
      unit: p.unit,
      cost_price: Number(p.cost_price ?? 0),
      cached_at: now,
    }))
  );
  await db.categories_cache.bulkPut(
    categories.map(c => ({
      id: c.id,
      name: c.name,
      station: c.station,
      sort_order: Number(c.sort_order ?? 0),
      cached_at: now,
    }))
  );
}

// Helper: enqueue operation
export async function enqueueOperation(
  operation_type: string,
  entity: string,
  payload: any,
  entity_id?: string
): Promise<string> {
  const db = getDB();
  const uuid = crypto.randomUUID();
  const device_id = await getDeviceId();
  await db.queue.put({
    uuid,
    created_at: Date.now(),
    device_id,
    operation_type,
    entity,
    entity_id,
    payload,
    status: 'pending',
    retry_count: 0,
  });
  return uuid;
}

// Helper: get pending operations
export async function getPendingOperations(): Promise<QueueItem[]> {
  const db = getDB();
  return db.queue.where('status').anyOf(['pending', 'failed']).toArray();
}

// Helper: update operation status
export async function updateOperationStatus(
  uuid: string,
  status: QueueItem['status'],
  updates?: Partial<QueueItem>
): Promise<void> {
  const db = getDB();
  await db.queue.update(uuid, { status, ...updates });
}

// Helper: get cached tables
export async function getCachedTables(): Promise<CachedTable[]> {
  const db = getDB();
  return db.tables_cache.toArray();
}

// Helper: get cached products
export async function getCachedProducts(): Promise<CachedProduct[]> {
  const db = getDB();
  return db.products_cache.toArray();
}

// Helper: get cached categories
export async function getCachedCategories(): Promise<CachedCategory[]> {
  const db = getDB();
  return db.categories_cache.toArray();
}

// Helper: count pending
export async function countPending(): Promise<number> {
  const db = getDB();
  return db.queue.where('status').anyOf(['pending', 'failed', 'syncing']).count();
}

// Helper: store session offline
export async function storeOfflineSession(user: any, token: string, refreshToken: string): Promise<void> {
  const db = getDB();
  await db.kv.put({ key: 'user', value: user });
  await db.kv.put({ key: 'access_token', value: token });
  await db.kv.put({ key: 'refresh_token', value: refreshToken });
  await db.kv.put({ key: 'last_online', value: Date.now() });
}

// Helper: get offline session
export async function getOfflineSession(): Promise<{ user: any; token: string; refreshToken: string } | null> {
  if (typeof window === 'undefined') return null;
  const db = getDB();
  const user = await db.kv.get('user');
  const token = await db.kv.get('access_token');
  const refresh = await db.kv.get('refresh_token');
  if (!user || !token) return null;
  return { user: user.value, token: token.value, refreshToken: refresh?.value ?? '' };
}

// Helper: clear session
export async function clearOfflineSession(): Promise<void> {
  const db = getDB();
  await db.kv.delete('user');
  await db.kv.delete('access_token');
  await db.kv.delete('refresh_token');
}
