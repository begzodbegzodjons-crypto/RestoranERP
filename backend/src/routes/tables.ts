/**
 * TABLES routes — restaurant tables management.
 *
 * GET    /api/tables                — list tables with current status (single query, no N+1)
 * POST   /api/tables                — create table
 * PUT    /api/tables/:id            — update table
 * DELETE /api/tables/:id            — soft delete
 * POST   /api/tables/:id/free      — force-free an occupied table (admin only)
 */
import { Router } from 'express';
import { pool, RowDataPacket, ResultSetHeader } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema } from '../validation/common';
import { NotFoundError, ConflictError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';

export const tablesRouter = Router();

const createTableSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50).default(4),
  section: z.string().max(50).nullable().optional(),
  branchId: cuidSchema.nullable().optional(),
  sortOrder: z.number().int().default(0),
});

const updateTableSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  section: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

tablesRouter.use(authRequired);

tablesRouter.get('/', requirePerm('table.read'), async (req, res, next) => {
  try {
    // Single query using v_tables_with_status view — avoids N+1
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, capacity, section, status, current_order_id,
              current_order_number, current_order_total, waiter_id, waiter_name,
              current_order_opened_at, current_order_items, sort_order, is_active
         FROM v_tables_with_status
        WHERE restaurant_id = ?
        ORDER BY sort_order ASC, name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

tablesRouter.get('/:id', requirePerm('table.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM v_tables_with_status WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (rows.length === 0) throw new NotFoundError('Table', req.params.id);
    return ok(res, rows[0]);
  } catch (err) { next(err); }
});

tablesRouter.post('/', requirePerm('table.manage'), validateBody(createTableSchema), async (req, res, next) => {
  try {
    const { name, capacity, section, branchId, sortOrder } = req.body;
    const id = entityId('tbl');
    await pool.execute(
      `INSERT INTO tables (id, restaurant_id, branch_id, name, capacity, section, status, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'free', ?, 1, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, branchId ?? null, name, capacity, section ?? null, sortOrder]
    );
    await auditReq(req, 'create', 'table', id, null, { name, capacity, section });
    return created(res, { id, name, capacity });
  } catch (err) { next(err); }
});

tablesRouter.put('/:id', requirePerm('table.manage'), validateBody(updateTableSchema), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, capacity, section, sort_order FROM tables WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Table', req.params.id);

    const { name, capacity, section, sortOrder, isActive } = req.body;
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tables SET
         name = COALESCE(?, name),
         capacity = COALESCE(?, capacity),
         section = COALESCE(?, section),
         sort_order = COALESCE(?, sort_order),
         is_active = COALESCE(?, is_active),
         updated_at = NOW(3)
       WHERE id = ? AND restaurant_id = ?`,
      [name ?? null, capacity ?? null, section ?? null, sortOrder ?? null,
       isActive === undefined ? null : (isActive ? 1 : 0),
       req.params.id, req.ctx!.restaurantId]
    );
    if (result.affectedRows === 0) throw new NotFoundError('Table', req.params.id);
    await auditReq(req, 'update', 'table', req.params.id, existing[0], req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

tablesRouter.delete('/:id', requirePerm('table.manage'), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, status FROM tables WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Table', req.params.id);
    if (existing[0].status === 'occupied') throw new ConflictError('Cannot delete an occupied table');

    await pool.execute(
      `UPDATE tables SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
      [req.params.id]
    );
    await auditReq(req, 'delete', 'table', req.params.id, existing[0], null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

tablesRouter.post('/:id/free', requirePerm('table.force_free'), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, status, current_order_id FROM tables WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Table', req.params.id);
    if (existing[0].status === 'free') return ok(res, { id: req.params.id, status: 'free', alreadyFree: true });

    await pool.execute(
      `UPDATE tables SET status = 'free', current_order_id = NULL, updated_at = NOW(3) WHERE id = ?`,
      [req.params.id]
    );
    await auditReq(req, 'force_free', 'table', req.params.id, existing[0], { status: 'free' });
    return ok(res, { id: req.params.id, status: 'free' });
  } catch (err) { next(err); }
});
