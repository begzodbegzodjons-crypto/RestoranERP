/**
 * SHIFTS routes — cashier shift management.
 *
 * GET    /api/shifts/current        — current open shift for cashier
 * POST   /api/shifts/open           — open new shift
 * POST   /api/shifts/:id/close      — close shift (cash reconciliation)
 * GET    /api/shifts                — list shifts (history)
 */
import { Router } from 'express';
import { pool, RowDataPacket } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { currencySchema } from '../validation/common';
import { ok, created } from '../utils/response';
import { NotFoundError, ConflictError } from '../errors';
import { entityId } from '../utils/id';

export const shiftsRouter = Router();

shiftsRouter.use(authRequired);

const openSchema = z.object({ openingCash: currencySchema.default(0) });
const closeSchema = z.object({
  closingCash: currencySchema,
  note: z.string().max(500).optional(),
});

shiftsRouter.get('/current', requirePerm('shift.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM shifts WHERE restaurant_id = ? AND cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [req.ctx!.restaurantId, req.ctx!.userId]
    );
    return ok(res, rows[0] ?? null);
  } catch (err) { next(err); }
});

shiftsRouter.post('/open', requirePerm('shift.open'), validateBody(openSchema), async (req, res, next) => {
  try {
    // Check no open shift
    const [openRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM shifts WHERE restaurant_id = ? AND cashier_id = ? AND status = 'open' LIMIT 1`,
      [req.ctx!.restaurantId, req.ctx!.userId]
    );
    if (openRows.length > 0) throw new ConflictError('Shift already open');

    const id = entityId('sft');
    await pool.execute(
      `INSERT INTO shifts (id, restaurant_id, cashier_id, opening_cash, status, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', NOW(3), NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, req.ctx!.userId, req.body.openingCash]
    );
    await auditReq(req, 'open', 'shift', id, null, { openingCash: req.body.openingCash });
    return created(res, { id, openingCash: req.body.openingCash, openedAt: new Date() });
  } catch (err) { next(err); }
});

shiftsRouter.post('/:id/close', requirePerm('shift.close'), validateBody(closeSchema), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, opening_cash, cash_sales, status FROM shifts
        WHERE id = ? AND restaurant_id = ? AND cashier_id = ? FOR UPDATE`,
      [req.params.id, req.ctx!.restaurantId, req.ctx!.userId]
    );
    if (rows.length === 0) throw new NotFoundError('Shift', req.params.id);
    if (rows[0].status === 'closed') throw new ConflictError('Shift already closed');
    const shift = rows[0];
    const expectedCash = Number(shift.opening_cash) + Number(shift.cash_sales);
    const difference = req.body.closingCash - expectedCash;
    await pool.execute(
      `UPDATE shifts SET closing_cash = ?, expected_cash = ?, cash_difference = ?, status = 'closed', closed_at = NOW(3), note = ?, updated_at = NOW(3)
       WHERE id = ?`,
      [req.body.closingCash, expectedCash, difference, req.body.note ?? null, req.params.id]
    );
    await auditReq(req, 'close', 'shift', req.params.id, shift, { closingCash: req.body.closingCash, difference });
    return ok(res, { id: req.params.id, expectedCash, actualCash: req.body.closingCash, difference });
  } catch (err) { next(err); }
});

shiftsRouter.get('/', requirePerm('shift.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, u.name AS cashier_name FROM shifts s
        JOIN users u ON u.id = s.cashier_id
        WHERE s.restaurant_id = ?
        ORDER BY s.opened_at DESC LIMIT 50`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});
