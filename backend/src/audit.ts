/**
 * Audit log helper — every state-changing action is recorded.
 * Insert-only table — never UPDATE or DELETE.
 */
import { pool } from './db';
import { logger } from './logger';

export interface AuditEntry {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO audit_logs
         (restaurant_id, user_id, action, entity, entity_id, before, after, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        entry.restaurantId,
        entry.userId ?? null,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ]
    );
  } catch (err) {
    // Audit failure must NOT break the main operation — log and continue.
    logger.error('Audit log write failed', { entry, err: (err as Error).message });
  }
}
