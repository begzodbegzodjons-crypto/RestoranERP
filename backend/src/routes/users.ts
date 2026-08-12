/**
 * USERS routes — admin staff management.
 *
 * GET    /api/users                — list users (admin)
 * POST   /api/users                — create user (admin)
 * GET    /api/users/:id            — get user detail (admin)
 * PUT    /api/users/:id            — update user (admin)
 * DELETE /api/users/:id            — deactivate user (soft delete) (admin)
 * POST   /api/users/:id/roles      — assign additional role
 * DELETE /api/users/:id/roles/:rid — remove role
 */
import { Router } from 'express';
import { pool, RowDataPacket, ResultSetHeader } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema, phoneSchema } from '../validation/common';
import { NotFoundError, ValidationError } from '../errors';
import { ok, created } from '../utils/response';
import { hashPassword } from '../auth/jwt';
import { entityId } from '../utils/id';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1).max(150),
  phone: phoneSchema,
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  password: z.string().min(6).max(100).optional(),
  roleId: cuidSchema,
  branchId: cuidSchema.nullable().optional(),
  deviceId: z.string().uuid().optional(),
}).refine(v => v.pin || v.password, { message: 'pin or password required' });

const updateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  phone: phoneSchema.optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  password: z.string().min(6).max(100).optional(),
  roleId: cuidSchema.optional(),
  branchId: cuidSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

usersRouter.use(authRequired);

usersRouter.get('/', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.phone, u.role_id, r.name AS role_name,
              r.display_name AS role_display_name, u.is_active, u.last_login_at, u.created_at
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.restaurant_id = ? AND u.deleted_at IS NULL
        ORDER BY u.name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

usersRouter.get('/:id', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.phone, u.role_id, r.name AS role_name,
              r.display_name AS role_display_name, u.is_active, u.last_login_at, u.created_at
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND u.restaurant_id = ? AND u.deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (rows.length === 0) throw new NotFoundError('User', req.params.id);
    return ok(res, rows[0]);
  } catch (err) { next(err); }
});

usersRouter.post('/', requirePerm('staff.manage'), validateBody(createUserSchema), async (req, res, next) => {
  try {
    const { name, phone, pin, password, roleId, branchId, deviceId } = req.body;
    const id = entityId('user');

    // Validate role belongs to restaurant
    const [roleRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM roles WHERE id = ? AND restaurant_id = ?`,
      [roleId, req.ctx!.restaurantId]
    );
    if (roleRows.length === 0) throw new ValidationError('Role does not belong to your restaurant');

    const pinHash = pin ? await hashPassword(pin) : null;
    const passwordHash = password ? await hashPassword(password) : null;

    await pool.execute(
      `INSERT INTO users (id, restaurant_id, branch_id, role_id, name, phone, pin_hash, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, branchId ?? null, roleId, name, phone, pinHash, passwordHash]
    );

    if (deviceId) {
      await pool.execute(
        `INSERT INTO devices (id, restaurant_id, user_id, name, type, is_active, created_at)
         VALUES (?, ?, ?, NULL, 'pos', 1, NOW(3))
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
        [deviceId, req.ctx!.restaurantId, id]
      );
    }

    await auditReq(req, 'create', 'user', id, null, { name, phone, roleId });

    return created(res, { id, name, phone, roleId });
  } catch (err) { next(err); }
});

usersRouter.put('/:id', requirePerm('staff.manage'), validateBody(updateUserSchema), async (req, res, next) => {
  try {
    const { name, phone, pin, password, roleId, branchId, isActive } = req.body;
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, phone, role_id, is_active FROM users WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('User', req.params.id);

    const pinHash = pin ? await hashPassword(pin) : undefined;
    const passwordHash = password ? await hashPassword(password) : undefined;

    const updates: string[] = ['updated_at = NOW(3)'];
    const params: unknown[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (pinHash !== undefined) { updates.push('pin_hash = ?'); params.push(pinHash); }
    if (passwordHash !== undefined) { updates.push('password_hash = ?'); params.push(passwordHash); }
    if (roleId !== undefined) { updates.push('role_id = ?'); params.push(roleId); }
    if (branchId !== undefined) { updates.push('branch_id = ?'); params.push(branchId); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    params.push(req.params.id, req.ctx!.restaurantId);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      params as any[]
    );
    if (result.affectedRows === 0) throw new NotFoundError('User', req.params.id);

    await auditReq(req, 'update', 'user', req.params.id, existing[0], req.body);

    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

usersRouter.delete('/:id', requirePerm('staff.manage'), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, is_active FROM users WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('User', req.params.id);

    // Soft delete + deactivate
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3)
       WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await pool.execute(`UPDATE sessions SET revoked_at = NOW(3) WHERE user_id = ?`, [req.params.id]);

    await auditReq(req, 'deactivate', 'user', req.params.id, existing[0], null);

    return ok(res, { id: req.params.id, deactivated: true });
  } catch (err) { next(err); }
});
