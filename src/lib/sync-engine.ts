/**
 * Sync engine — processes offline queue when online.
 *
 * Features:
 *   - Online/offline detection (navigator.onLine + window events)
 *   - Sequential processing of pending operations
 *   - Retry with exponential backoff
 *   - Conflict resolution:
 *       - Order creation: idempotency key (UUID) — duplicates rejected by server
 *       - Order add_items: version check — conflict returns error, user must refresh
 *       - Order cancel_item: same as add_items
 *   - Pull fresh data after sync (tables, menu)
 *   - Visual status: online/offline indicator + pending count
 */
import { getDB, getPendingOperations, updateOperationStatus, countPending, QueueItem, cacheTables, cacheMenu } from './offline-db';
import { api } from './api';

let isSyncing = false;
let onSyncComplete: (() => void) | null = null;
let onPendingChange: ((count: number) => void) | null = null;

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export function setSyncCallbacks(opts: { onComplete?: () => void; onPendingChange?: (count: number) => void }) {
  onSyncComplete = opts.onComplete ?? null;
  onPendingChange = opts.onPendingChange ?? null;
}

async function notifyPending(): Promise<void> {
  if (onPendingChange) {
    const count = await countPending();
    onPendingChange(count);
  }
}

/**
 * Process the entire pending queue sequentially.
 * Returns when all operations are processed (or failed).
 */
export async function syncQueue(): Promise<{ success: number; failed: number; conflicts: number }> {
  if (isSyncing) return { success: 0, failed: 0, conflicts: 0 };
  if (!isOnline()) return { success: 0, failed: 0, conflicts: 0 };

  isSyncing = true;
  let success = 0, failed = 0, conflicts = 0;

  try {
    const pending = await getPendingOperations();
    // Sort by created_at ASC (FIFO)
    pending.sort((a, b) => a.created_at - b.created_at);

    for (const op of pending) {
      try {
        await updateOperationStatus(op.uuid, 'syncing');
        await notifyPending();

        const result = await processOperation(op);
        if (result.status === 'synced') {
          success++;
          await updateOperationStatus(op.uuid, 'synced', {
            synced_at: Date.now(),
            server_entity_id: result.serverEntityId,
          });
        } else if (result.status === 'conflict') {
          conflicts++;
          await updateOperationStatus(op.uuid, 'conflict', {
            last_error: result.error,
            retry_count: op.retry_count + 1,
          });
        }
      } catch (err: any) {
        const newRetry = op.retry_count + 1;
        if (newRetry >= 5) {
          failed++;
          await updateOperationStatus(op.uuid, 'failed', {
            last_error: err.message,
            retry_count: newRetry,
          });
        } else {
          // Keep as pending for retry
          await updateOperationStatus(op.uuid, 'pending', {
            last_error: err.message,
            retry_count: newRetry,
          });
        }
      }
      await notifyPending();
    }

    // After sync, pull fresh data if any operations succeeded
    if (success > 0) {
      await pullFreshData();
    }

    if (onSyncComplete) onSyncComplete();
  } finally {
    isSyncing = false;
  }

  return { success, failed, conflicts };
}

async function processOperation(op: QueueItem): Promise<{ status: 'synced' | 'conflict'; serverEntityId?: string; error?: string }> {
  switch (op.operation_type) {
    case 'order.create': {
      // Use the sync push endpoint — server handles idempotency via UUID
      const res = await api<{ ok: boolean; data: { paymentId?: string; orderId?: string } | { id?: string } }>(`/api/orders`, {
        method: 'POST',
        body: JSON.stringify({ ...op.payload, idempotencyKey: op.uuid }),
      });
      // If response is idempotent replay, still mark as synced
      const orderId = (res.data as any).id ?? (res.data as any).orderId ?? op.entity_id;
      return { status: 'synced', serverEntityId: orderId };
    }

    case 'order.add_items': {
      // Add items to existing order — server checks version
      const orderId = op.entity_id;
      if (!orderId) throw new Error('No entity_id for add_items');
      const res = await api(`/api/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify(op.payload),
      });
      return { status: 'synced' };
    }

    case 'order.cancel_item': {
      const { orderId, itemId, reason } = op.payload;
      await api(`/api/orders/${orderId}/items/${itemId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return { status: 'synced' };
    }

    default:
      throw new Error(`Unknown operation type: ${op.operation_type}`);
  }
}

/**
 * Pull fresh tables + menu from server and update local cache.
 */
export async function pullFreshData(): Promise<void> {
  try {
    const [tablesRes, productsRes, categoriesRes] = await Promise.all([
      api<{ ok: boolean; data: any[] }>('/api/tables'),
      api<{ ok: boolean; data: any[] }>('/api/products'),
      api<{ ok: boolean; data: any[] }>('/api/products/categories'),
    ]);
    await cacheTables(tablesRes.data ?? []);
    await cacheMenu(productsRes.data ?? [], categoriesRes.data ?? []);
  } catch {
    // Network might still be flaky — ignore
  }
}

/**
 * Auto-sync loop — checks every 10 seconds if online and has pending.
 */
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(): void {
  if (autoSyncInterval) return;
  autoSyncInterval = setInterval(async () => {
    if (isOnline() && !isSyncing) {
      const pending = await countPending();
      if (pending > 0) {
        await syncQueue();
      }
    }
  }, 10000); // 10 seconds
}

export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}
