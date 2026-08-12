/**
 * INVENTORY routes — ingredients, stock, purchases, recipes, counts.
 *
 * GET    /api/inventory                — list ingredients (with stock + alerts)
 * POST   /api/inventory                — create ingredient
 * PUT    /api/inventory/:id            — update
 * DELETE /api/inventory/:id            — soft delete
 * POST   /api/inventory/:id/adjust     — manual stock adjust (in/out/waste) with reason
 * GET    /api/inventory/transactions    — list stock movements (filter by ingredient, type, date)
 *
 * GET    /api/purchases                — list purchases
 * POST   /api/purchases                — create purchase (atomic: increase stock + supplier balance)
 *
 * GET    /api/recipes                  — list recipes
 * POST   /api/recipes                  — create recipe (BOM)
 * PUT    /api/recipes/:id              — update quantity
 * DELETE /api/recipes/:id              — delete
 *
 * POST   /api/inventory-counts         — start a new count
 * GET    /api/inventory-counts         — list counts
 * POST   /api/inventory-counts/:id/items/:ingredientId — enter actual qty
 * POST   /api/inventory-counts/:id/complete — finalize (apply differences)
 */
import { Router } from 'express';
import { pool, RowDataPacket, withTransaction } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema, currencySchema, quantitySchema } from '../validation/common';
import { NotFoundError, ConflictError, ValidationError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';

export const inventoryRouter = Router();

inventoryRouter.use(authRequired);

// ============== INGREDIENTS ==============

const createIngredientSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).nullable().optional(),
  unit: z.string().max(20).default('piece'),
  stock: quantitySchema.default(0),
  minStock: quantitySchema.default(0),
  cost: currencySchema.default(0),
  supplierId: cuidSchema.nullable().optional(),
});

inventoryRouter.get('/', requirePerm('inventory.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, s.name AS supplier_name,
              CASE WHEN i.stock < i.min_stock THEN 1 ELSE 0 END AS is_low_stock
         FROM inventory i
         LEFT JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.restaurant_id = ? AND i.deleted_at IS NULL
        ORDER BY i.name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

inventoryRouter.post('/', requirePerm('inventory.manage'), validateBody(createIngredientSchema), async (req, res, next) => {
  try {
    const { name, sku, unit, stock, minStock, cost, supplierId } = req.body;
    const id = entityId('inv');
    await pool.execute(
      `INSERT INTO inventory (id, restaurant_id, name, sku, unit, stock, min_stock, cost, supplier_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, name, sku ?? null, unit, stock, minStock, cost, supplierId ?? null]
    );
    // Initial stock movement
    if (stock > 0) {
      await pool.execute(
        `INSERT INTO inventory_transactions (inventory_id, restaurant_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
         VALUES (?, ?, 'in', ?, ?, 'Initial stock', 'manual', ?, ?, NOW(3))`,
        [id, req.ctx!.restaurantId, stock, cost, id, req.ctx!.userId]
      );
    }
    await auditReq(req, 'create', 'inventory', id, null, { name, stock });
    return created(res, { id, name });
  } catch (err) { next(err); }
});

inventoryRouter.put('/:id', requirePerm('inventory.manage'), async (req, res, next) => {
  try {
    const { name, sku, unit, minStock, cost, supplierId, isActive } = req.body;
    const [r] = await pool.execute(
      `UPDATE inventory SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        unit = COALESCE(?, unit),
        min_stock = COALESCE(?, min_stock),
        cost = COALESCE(?, cost),
        supplier_id = COALESCE(?, supplier_id),
        is_active = COALESCE(?, is_active),
        updated_at = NOW(3)
       WHERE id = ? AND restaurant_id = ?`,
      [name ?? null, sku ?? null, unit ?? null, minStock ?? null, cost ?? null, supplierId ?? null,
       isActive === undefined ? null : (isActive ? 1 : 0), req.params.id, req.ctx!.restaurantId]
    ) as any;
    if (r.affectedRows === 0) throw new NotFoundError('Ingredient', req.params.id);
    await auditReq(req, 'update', 'inventory', req.params.id, null, req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

inventoryRouter.delete('/:id', requirePerm('inventory.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE inventory SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await auditReq(req, 'delete', 'inventory', req.params.id, null, null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

const adjustSchema = z.object({
  type: z.enum(['in', 'out', 'adjust', 'waste']),
  quantity: z.number().refine(q => q !== 0, 'Quantity must not be 0'),
  reason: z.string().min(1).max(200),
  unitCost: currencySchema.optional(),
});

inventoryRouter.post('/:id/adjust', requirePerm('inventory.adjust'), validateBody(adjustSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      const [ingRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, stock, cost FROM inventory WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id, req.ctx!.restaurantId]
      );
      if (ingRows.length === 0) throw new NotFoundError('Ingredient', req.params.id);
      const ing = ingRows[0];
      // For 'in', quantity is positive; for 'out'/'waste', quantity must be negative or we negate it
      let delta = req.body.quantity;
      if (req.body.type === 'out' || req.body.type === 'waste') {
        if (delta > 0) delta = -delta;
        if (ing.stock + delta < 0) {
          throw new ConflictError(`Insufficient stock (have ${ing.stock}, need ${-delta})`);
        }
      }
      const newStock = ing.stock + delta;
      const unitCost = req.body.unitCost ?? ing.cost;
      await conn.execute(
        `UPDATE inventory SET stock = ?, cost = COALESCE(?, cost), updated_at = NOW(3) WHERE id = ?`,
        [newStock, req.body.type === 'in' ? unitCost : null, ing.id]
      );
      await conn.execute(
        `INSERT INTO inventory_transactions (inventory_id, restaurant_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, NOW(3))`,
        [ing.id, req.ctx!.restaurantId, req.body.type, delta, unitCost, req.body.reason, ing.id, req.ctx!.userId]
      );
      return { id: ing.id, newStock };
    });
    await auditReq(req, 'adjust', 'inventory', req.params.id, null, req.body);
    return ok(res, result);
  } catch (err) { next(err); }
});

inventoryRouter.get('/transactions', requirePerm('inventory.read'), async (req, res, next) => {
  try {
    const ingredientId = req.query.ingredientId as string | undefined;
    const type = req.query.type as string | undefined;
    const where: string[] = ['it.restaurant_id = ?'];
    const params: unknown[] = [req.ctx!.restaurantId];
    if (ingredientId) { where.push('it.inventory_id = ?'); params.push(ingredientId); }
    if (type) { where.push('it.type = ?'); params.push(type); }
    params.push(100);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT it.*, i.name AS ingredient_name, u.name AS user_name
         FROM inventory_transactions it
         LEFT JOIN inventory i ON i.id = it.inventory_id
         LEFT JOIN users u ON u.id = it.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY it.created_at DESC
        LIMIT ?`,
      params
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

// ============== PURCHASES ==============

const purchaseItemSchema = z.object({
  ingredientId: cuidSchema,
  quantity: quantitySchema,
  unitPrice: currencySchema,
});

const createPurchaseSchema = z.object({
  supplierId: cuidSchema,
  paidAmount: currencySchema.default(0),
  items: z.array(purchaseItemSchema).min(1).max(100),
  note: z.string().max(500).nullable().optional(),
});

inventoryRouter.post('/purchases', requirePerm('purchase.manage'), validateBody(createPurchaseSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (conn) => {
      let total = 0;
      for (const it of req.body.items) {
        const lineTotal = it.quantity * it.unitPrice;
        total += lineTotal;
        // Increase stock + record transaction
        await conn.execute(
          `UPDATE inventory SET stock = stock + ?, cost = ?, updated_at = NOW(3)
           WHERE id = ? AND restaurant_id = ?`,
          [it.quantity, it.unitPrice, it.ingredientId, req.ctx!.restaurantId]
        );
        await conn.execute(
          `INSERT INTO inventory_transactions (inventory_id, restaurant_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
           VALUES (?, ?, 'in', ?, ?, ?, 'purchase', ?, ?, NOW(3))`,
          [it.ingredientId, req.ctx!.restaurantId, it.quantity, it.unitPrice,
           `Purchase from supplier ${req.body.supplierId}`,
           req.body.supplierId, req.ctx!.userId]
        );
      }
      // Update supplier balance (if not fully paid)
      const unpaid = total - req.body.paidAmount;
      if (unpaid > 0) {
        await conn.execute(
          `UPDATE suppliers SET balance = balance - ?, updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
          [unpaid, req.body.supplierId, req.ctx!.restaurantId]
        );
      }
      return { total, paid: req.body.paidAmount, unpaid, items: req.body.items.length };
    });
    await auditReq(req, 'create', 'purchase', undefined, null, result);
    return created(res, result);
  } catch (err) { next(err); }
});

// ============== RECIPES ==============

const recipeSchema = z.object({
  productId: cuidSchema,
  inventoryId: cuidSchema,
  quantity: z.number().positive(),
  unit: z.string().max(20).default('piece'),
});

inventoryRouter.get('/recipes', requirePerm('inventory.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, p.name AS product_name, i.name AS ingredient_name
         FROM recipes r
         JOIN products p ON p.id = r.product_id
         JOIN inventory i ON i.id = r.inventory_id
        WHERE r.restaurant_id = ?
        ORDER BY p.name, i.name`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

inventoryRouter.post('/recipes', requirePerm('inventory.manage'), validateBody(recipeSchema), async (req, res, next) => {
  try {
    const id = entityId('rec');
    await pool.execute(
      `INSERT INTO recipes (id, restaurant_id, product_id, inventory_id, quantity, unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, req.body.productId, req.body.inventoryId, req.body.quantity, req.body.unit]
    );
    return created(res, { id, ...req.body });
  } catch (err) { next(err); }
});

inventoryRouter.put('/recipes/:id', requirePerm('inventory.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE recipes SET quantity = ?, unit = ?, updated_at = NOW(3)
       WHERE id = ? AND restaurant_id = ?`,
      [req.body.quantity, req.body.unit, req.params.id, req.ctx!.restaurantId]
    );
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

inventoryRouter.delete('/recipes/:id', requirePerm('inventory.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `DELETE FROM recipes WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});
