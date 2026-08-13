/**
 * PRINTERS routes — printer CRUD, printer routes, print jobs queue (for print server polling).
 *
 * GET    /api/printers               — list printers
 * POST   /api/printers               — create printer
 * PUT    /api/printers/:id          — update
 * DELETE /api/printers/:id          — soft delete
 * GET    /api/printers/routes        — list printer routes
 * POST   /api/printers/routes        — create route
 * DELETE /api/printers/routes/:id    — delete route
 * GET    /api/print-jobs/pending     — list pending print jobs (for print server)
 * PUT    /api/print-jobs/:id/status  — mark printed / failed (print server)
 * POST   /api/printers/:id/test      — queue a test print job
 */
import { Router } from 'express';
import { pool, RowDataPacket } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema } from '../validation/common';
import { NotFoundError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';

export const printersRouter = Router();

printersRouter.use(authRequired);

const createPrinterSchema = z.object({
  name: z.string().min(1).max(100),
  station: z.enum(['kitchen', 'kebab', 'cashier', 'bar', 'other']),
  connectionType: z.enum(['usb', 'lan']),
  ipAddress: z.string().max(45).nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  usbName: z.string().max(255).nullable().optional(),
  paperWidth: z.number().int().refine(w => [58, 80].includes(w)).default(58),
  charset: z.string().max(20).default('cp866'),
  retryCount: z.number().int().min(0).max(10).default(3),
  timeoutMs: z.number().int().min(1000).max(60000).default(5000),
  enabled: z.boolean().default(true),
});

printersRouter.get('/', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM printers WHERE restaurant_id = ? AND deleted_at IS NULL ORDER BY station, name`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

printersRouter.post('/', requirePerm('printer.manage'), validateBody(createPrinterSchema), async (req, res, next) => {
  try {
    const id = entityId('prn');
    await pool.execute(
      `INSERT INTO printers (id, restaurant_id, name, station, connection_type, ip_address, port, usb_name,
                              paper_width, charset, retry_count, timeout_ms, enabled, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, req.body.name, req.body.station, req.body.connectionType,
       req.body.ipAddress ?? null, req.body.port ?? null, req.body.usbName ?? null,
       req.body.paperWidth, req.body.charset, req.body.retryCount, req.body.timeoutMs,
       req.body.enabled ? 1 : 0]
    );
    await auditReq(req, 'create', 'printer', id, null, req.body);
    return created(res, { id, ...req.body });
  } catch (err) { next(err); }
});

printersRouter.put('/:id', requirePerm('printer.manage'), validateBody(createPrinterSchema.partial()), async (req, res, next) => {
  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(req.body)) {
      const col = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      updates.push(`${col} = ?`);
      params.push(v);
    }
    updates.push('updated_at = NOW(3)');
    params.push(req.params.id, req.ctx!.restaurantId);
    const [r] = await pool.execute(
      `UPDATE printers SET ${updates.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      params as any[]
    ) as any;
    if (r.affectedRows === 0) throw new NotFoundError('Printer', req.params.id);
    await auditReq(req, 'update', 'printer', req.params.id, null, req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

printersRouter.delete('/:id', requirePerm('printer.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE printers SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await auditReq(req, 'delete', 'printer', req.params.id, null, null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

// ----- Printer routes -----
const createRouteSchema = z.object({
  printerId: cuidSchema,
  sourceType: z.enum(['category', 'station', 'order_type']),
  sourceId: cuidSchema.nullable().optional(),
  station: z.enum(['kitchen', 'kebab', 'cashier', 'bar', 'other']).nullable().optional(),
  event: z.enum(['order', 'receipt', 'cancel', 'zreport']).default('order'),
  priority: z.number().int().default(0),
});

printersRouter.get('/routes', requirePerm('staff.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pr.*, p.name AS printer_name, p.station AS printer_station
         FROM printer_routes pr
         JOIN printers p ON p.id = pr.printer_id
        WHERE pr.restaurant_id = ? AND pr.is_active = 1
        ORDER BY pr.event, pr.priority`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

printersRouter.post('/routes', requirePerm('printer.manage'), validateBody(createRouteSchema), async (req, res, next) => {
  try {
    const id = entityId('prt');
    await pool.execute(
      `INSERT INTO printer_routes (id, restaurant_id, printer_id, source_type, source_id, station, event, priority, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3))`,
      [id, req.ctx!.restaurantId, req.body.printerId, req.body.sourceType,
       req.body.sourceId ?? null, req.body.station ?? null, req.body.event, req.body.priority]
    );
    return created(res, { id, ...req.body });
  } catch (err) { next(err); }
});

printersRouter.delete('/routes/:id', requirePerm('printer.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE printer_routes SET is_active = 0 WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

// ----- Print jobs (polling endpoint for print server) -----
printersRouter.get('/print-jobs/pending', async (req, res, next) => {
  // Print server polls this with its API token (separate auth) — but we allow staff too
  try {
    const station = req.query.station as string | undefined;
    let querySql = `SELECT * FROM v_print_jobs_pending WHERE restaurant_id = ?`;
    const params: unknown[] = [req.ctx!.restaurantId];
    if (station) { querySql += ` AND station = ?`; params.push(station); }
    querySql += ` ORDER BY queued_at ASC LIMIT 50`;
    const [rows] = await pool.query<RowDataPacket[]>(querySql, params);
    // Convert payload Buffer to base64 for JSON transport
    const result = rows.map(r => ({
      ...r,
      payload: r.payload ? Buffer.from(r.payload).toString('base64') : null
    }));
    return ok(res, result);
  } catch (err) { next(err); }
});

const updateJobStatusSchema = z.object({
  status: z.enum(['printed', 'failed']),
  error: z.string().max(500).optional(),
});

printersRouter.put('/print-jobs/:id/status', validateBody(updateJobStatusSchema), async (req, res, next) => {
  try {
    if (req.body.status === 'printed') {
      await pool.execute(
        `UPDATE print_jobs SET status = 'printed', attempts = attempts + 1, printed_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
        [req.params.id, req.ctx!.restaurantId]
      );
    } else {
      await pool.execute(
        `UPDATE print_jobs SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
          attempts = attempts + 1, last_error = ? WHERE id = ? AND restaurant_id = ?`,
        [req.body.error ?? null, req.params.id, req.ctx!.restaurantId]
      );
    }
    return ok(res, { id: req.params.id, status: req.body.status });
  } catch (err) { next(err); }
});

printersRouter.post('/:id/test', requirePerm('printer.test'), async (req, res, next) => {
  try {
    // Fetch printer details to generate proper test payload
    const [printerRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, station, paper_width FROM printers WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (printerRows.length === 0) throw new NotFoundError('Printer', req.params.id);
    const printer = printerRows[0];

    // Generate ESC/POS test payload
    const { encodeTestPrint } = require('../printer/escpos');
    const payload = encodeTestPrint(printer.name, printer.station);

    const id = entityId('pj');
    await pool.execute(
      `INSERT INTO print_jobs (id, restaurant_id, printer_id, order_id, payment_id, type, payload, status, idempotency_key, queued_at)
       VALUES (?, ?, ?, NULL, NULL, 'test', ?, 'pending', ?, NOW(3))`,
      [id, req.ctx!.restaurantId, req.params.id, payload, `test_${Date.now()}`]
    );
    return created(res, { jobId: id, message: 'Test print queued', printer: printer.name });
  } catch (err) { next(err); }
});
