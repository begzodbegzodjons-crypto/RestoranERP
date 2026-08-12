/**
 * RBAC — fetches user's permissions from DB (via v_user_permissions view)
 * and caches them for the request lifetime.
 *
 * Permissions are stored as flat strings: "<module>.<action>"
 * e.g. "order.create", "payment.read", "report.zreport"
 *
 * A role with permission "*" or "all" bypasses all checks (admin role).
 */
import { pool, RowDataPacket } from '../db';

const ADMIN_ROLE_NAME = 'admin';

export interface AuthContext {
  userId: string;
  restaurantId: string;
  roleId?: string;
  roleName?: string;
  permissions: Set<string>;
  ip?: string;
  userAgent?: string;
}

export async function loadUserContext(userId: string, restaurantId: string): Promise<AuthContext | null> {
  // Get user + role
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.restaurant_id, u.role_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.restaurant_id = ? AND u.is_active = 1 AND u.deleted_at IS NULL
      LIMIT 1`,
    [userId, restaurantId]
  );
  if (userRows.length === 0) return null;
  const u = userRows[0];

  // Get permissions
  const [permRows] = await pool.query<RowDataPacket[]>(
    `SELECT permission_code FROM v_user_permissions WHERE user_id = ?`,
    [userId]
  );
  const perms = new Set<string>(permRows.map(r => r.permission_code));

  // Admin role bypass
  if (u.role_name === ADMIN_ROLE_NAME) perms.add('*');

  return {
    userId: u.id,
    restaurantId: u.restaurant_id,
    roleId: u.role_id,
    roleName: u.role_name,
    permissions: perms,
  };
}

export function hasPermission(ctx: AuthContext, perm: string): boolean {
  if (ctx.permissions.has('*')) return true;
  if (ctx.permissions.has(perm)) return true;
  // Wildcard module: e.g. "order.*" matches "order.create"
  const moduleWildcard = perm.split('.')[0] + '.*';
  return ctx.permissions.has(moduleWildcard);
}

export function requirePermission(ctx: AuthContext, perm: string): void {
  if (!hasPermission(ctx, perm)) {
    throw new ForbiddenError(`Required permission: ${perm}`);
  }
}
import { ForbiddenError } from '../errors';
