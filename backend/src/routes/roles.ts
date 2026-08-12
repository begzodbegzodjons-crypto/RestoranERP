/**
 * ROLES routes — role + permission management.
 *
 * GET    /api/roles                 — list roles
 * POST   /api/roles                 — create custom role
 * PUT    /api/roles/:id             — update role
 * DELETE /api/roles/:id             — delete role (only non-system)
 * GET    /api/roles/:id/permissions — list permissions for role
 * PUT    /api/roles/:id/permissions  — set permissions for role
 * GET    /api/permissions           — list all available permissions
 */
import { Router } from 'express';
import { pool, RowDataPacket, ResultSetHeader, withTransaction } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema } from '../validation/common';
import { NotFoundError, ValidationError, ConflictError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';

export const rolesRouter = Router();

const createRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z_]+$/, 'lowercase + underscore only'),
  displayName: z.string().min(1).max(100),
  description: z.string().max(255).nullable().optional(),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
});

const setPermissionsSchema = z.object({
  permissionIds: z.array(cuidSchema).min(0).max(100),
});

rolesRouter.use(authRequired);

rolesRouter.get('/permissions', requirePerm('staff.read'), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, code, module, description FROM permissions ORDER BY module, code`
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

rolesRouter.get('/', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.name, r.display_name, r.description, r.is_system, r.created_at,
              (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permissions_count
         FROM roles r
        WHERE r.restaurant_id = ? AND r.deleted_at IS NULL
        ORDER BY r.is_system DESC, r.name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

rolesRouter.get('/:id', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.name, r.display_name, r.description, r.is_system, r.created_at
         FROM roles r
        WHERE r.id = ? AND r.restaurant_id = ? AND r.deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (rows.length === 0) throw new NotFoundError('Role', req.params.id);
    const [perms] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.code, p.module FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ? ORDER BY p.module, p.code`,
      [req.params.id]
    );
    return ok(res, { ...rows[0], permissions: perms });
  } catch (err) { next(err); }
});

rolesRouter.post('/', requirePerm('role.manage'), validateBody(createRoleSchema), async (req, res, next) => {
  try {
    const { name, displayName, description } = req.body;
    const id = entityId('role');
    await pool.execute(
      `INSERT INTO roles (id, restaurant_id, name, display_name, description, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, name, displayName, description ?? null]
    );
    await auditReq(req, 'create', 'role', id, null, { name, displayName });
    return created(res, { id, name, displayName });
  } catch (err) { next(err); }
});

rolesRouter.put('/:id', requirePerm('role.manage'), validateBody(updateRoleSchema), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, display_name, description FROM roles WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Role', req.params.id);

    const { displayName, description } = req.body;
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE roles SET display_name = COALESCE(?, display_name), description = COALESCE(?, description), updated_at = NOW(3)
       WHERE id = ? AND restaurant_id = ?`,
      [displayName ?? null, description ?? null, req.params.id, req.ctx!.restaurantId]
    );
    if (result.affectedRows === 0) throw new NotFoundError('Role', req.params.id);

    await auditReq(req, 'update', 'role', req.params.id, existing[0], req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

rolesRouter.delete('/:id', requirePerm('role.manage'), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, is_system, name FROM roles WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Role', req.params.id);
    if (existing[0].is_system) throw new ValidationError('Cannot delete system role');

    // Check no users assigned
    const [userCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE role_id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (userCount[0].cnt > 0) throw new ConflictError(`Role still has ${userCount[0].cnt} active users`);

    await pool.execute(
      `UPDATE roles SET deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await auditReq(req, 'delete', 'role', req.params.id, existing[0], null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

rolesRouter.put('/:id/permissions', requirePerm('role.manage'), validateBody(setPermissionsSchema), async (req, res, next) => {
  try {
    const { permissionIds } = req.body;
    // Verify role exists in restaurant
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM roles WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Role', req.params.id);

    await withTransaction(async (conn) => {
      await conn.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
      for (const pid of permissionIds) {
        await conn.execute(
          `INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW(3))`,
          [req.params.id, pid]
        );
      }
    });

    await auditReq(req, 'update_permissions', 'role', req.params.id, null, { permissionIds });
    return ok(res, { roleId: req.params.id, permissionCount: permissionIds.length });
  } catch (err) { next(err); }
});
