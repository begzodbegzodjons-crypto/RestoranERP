/**
 * PRODUCTS routes — categories, products, prices, variants.
 *
 * GET    /api/categories             — list categories
 * POST   /api/categories             — create category
 * PUT    /api/categories/:id         — update
 * DELETE /api/categories/:id         — soft delete
 *
 * GET    /api/products               — list products (with current prices)
 * POST   /api/products               — create product
 * GET    /api/products/:id           — get product detail
 * PUT    /api/products/:id           — update product
 * DELETE /api/products/:id           — soft delete
 * PUT    /api/products/:id/price     — set new price (creates new product_prices row)
 * POST   /api/products/:id/variants  — add variant
 */
import { Router } from 'express';
import { pool, RowDataPacket, ResultSetHeader } from '../db';
import { authRequired, requirePerm, validateBody, auditReq } from '../middleware';
import { z } from 'zod';
import { cuidSchema, currencySchema, stationSchema } from '../validation/common';
import { NotFoundError, ConflictError } from '../errors';
import { ok, created } from '../utils/response';
import { entityId } from '../utils/id';
import { withTransaction } from '../db';

export const productsRouter = Router();

// --- Categories ---
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  station: stationSchema.default('kitchen'),
  sortOrder: z.number().int().default(0),
});

productsRouter.use(authRequired);

productsRouter.get('/categories', requirePerm('menu.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, station, sort_order, is_active, created_at
         FROM categories
        WHERE restaurant_id = ? AND deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

productsRouter.post('/categories', requirePerm('menu.manage'), validateBody(createCategorySchema), async (req, res, next) => {
  try {
    const { name, station, sortOrder } = req.body;
    const id = entityId('cat');
    await pool.execute(
      `INSERT INTO categories (id, restaurant_id, name, station, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, req.ctx!.restaurantId, name, station, sortOrder]
    );
    await auditReq(req, 'create', 'category', id, null, { name, station });
    return created(res, { id, name, station });
  } catch (err) { next(err); }
});

productsRouter.put('/categories/:id', requirePerm('menu.manage'), validateBody(createCategorySchema.partial()), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, station, sort_order FROM categories WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Category', req.params.id);
    const { name, station, sortOrder } = req.body;
    await pool.execute(
      `UPDATE categories SET name = COALESCE(?, name), station = COALESCE(?, station),
        sort_order = COALESCE(?, sort_order), updated_at = NOW(3) WHERE id = ?`,
      [name ?? null, station ?? null, sortOrder ?? null, req.params.id]
    );
    await auditReq(req, 'update', 'category', req.params.id, existing[0], req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

productsRouter.delete('/categories/:id', requirePerm('menu.manage'), async (req, res, next) => {
  try {
    const [prodCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM products WHERE category_id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (prodCount[0].cnt > 0) throw new ConflictError(`Category still has ${prodCount[0].cnt} products`);
    await pool.execute(
      `UPDATE categories SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await auditReq(req, 'delete', 'category', req.params.id, null, null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

// --- Products ---
const createProductSchema = z.object({
  categoryId: cuidSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  type: stationSchema.default('kitchen'),
  unit: z.string().max(20).default('piece'),
  costPrice: currencySchema.default(0),
  price: currencySchema,
  hasVariants: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const updateProductSchema = z.object({
  categoryId: cuidSchema.nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  type: stationSchema.optional(),
  unit: z.string().max(20).optional(),
  costPrice: currencySchema.optional(),
  hasVariants: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

productsRouter.get('/', requirePerm('menu.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.category_id, p.name, p.description, p.sku, p.type, p.unit, p.cost_price,
              p.is_active, p.has_variants, p.sort_order, p.created_at,
              pp.price AS current_price,
              c.name AS category_name, c.station AS category_station
         FROM products p
         LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.effective_to IS NULL
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.restaurant_id = ? AND p.deleted_at IS NULL
        ORDER BY p.sort_order ASC, p.name ASC`,
      [req.ctx!.restaurantId]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
});

productsRouter.get('/:id', requirePerm('menu.read'), async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, pp.price AS current_price, c.name AS category_name
         FROM products p
         LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.effective_to IS NULL
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ? AND p.restaurant_id = ? AND p.deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (rows.length === 0) throw new NotFoundError('Product', req.params.id);
    const [variants] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, price_delta, is_active FROM product_variants WHERE product_id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    const [priceHistory] = await pool.query<RowDataPacket[]>(
      `SELECT id, price, effective_from, effective_to, created_at FROM product_prices WHERE product_id = ? ORDER BY effective_from DESC`,
      [req.params.id]
    );
    return ok(res, { ...rows[0], variants, priceHistory });
  } catch (err) { next(err); }
});

productsRouter.post('/', requirePerm('menu.manage'), validateBody(createProductSchema), async (req, res, next) => {
  try {
    const { categoryId, name, description, sku, type, unit, costPrice, price, hasVariants, sortOrder } = req.body;
    const id = entityId('prod');
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO products (id, restaurant_id, category_id, name, description, sku, type, unit, cost_price, is_active, has_variants, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(3), NOW(3))`,
        [id, req.ctx!.restaurantId, categoryId ?? null, name, description ?? null, sku ?? null, type, unit, costPrice, hasVariants ? 1 : 0, sortOrder]
      );
      // Insert initial price
      await conn.execute(
        `INSERT INTO product_prices (id, product_id, price, currency, effective_from, effective_to, created_at)
         VALUES (?, ?, ?, 'UZS', NOW(3), NULL, NOW(3))`,
        [entityId('pp'), id, price]
      );
    });
    await auditReq(req, 'create', 'product', id, null, { name, type, price });
    return created(res, { id, name, price });
  } catch (err) { next(err); }
});

productsRouter.put('/:id', requirePerm('menu.manage'), validateBody(updateProductSchema), async (req, res, next) => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM products WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Product', req.params.id);
    const b = req.body;
    await pool.execute(
      `UPDATE products SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        sku = COALESCE(?, sku),
        type = COALESCE(?, type),
        unit = COALESCE(?, unit),
        cost_price = COALESCE(?, cost_price),
        has_variants = COALESCE(?, has_variants),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = NOW(3)
       WHERE id = ?`,
      [b.categoryId ?? null, b.name ?? null, b.description ?? null, b.sku ?? null, b.type ?? null,
       b.unit ?? null, b.costPrice ?? null, b.hasVariants === undefined ? null : (b.hasVariants ? 1 : 0),
       b.sortOrder ?? null, b.isActive === undefined ? null : (b.isActive ? 1 : 0),
       req.params.id]
    );
    await auditReq(req, 'update', 'product', req.params.id, existing[0], req.body);
    return ok(res, { id: req.params.id, updated: true });
  } catch (err) { next(err); }
});

productsRouter.delete('/:id', requirePerm('menu.manage'), async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE products SET is_active = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND restaurant_id = ?`,
      [req.params.id, req.ctx!.restaurantId]
    );
    await auditReq(req, 'delete', 'product', req.params.id, null, null);
    return ok(res, { id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

productsRouter.put('/:id/price', requirePerm('menu.price'), async (req, res, next) => {
  try {
    const price = currencySchema.parse(req.body?.price);
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM products WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.ctx!.restaurantId]
    );
    if (existing.length === 0) throw new NotFoundError('Product', req.params.id);

    await withTransaction(async (conn) => {
      // Close current price
      await conn.execute(
        `UPDATE product_prices SET effective_to = NOW(3) WHERE product_id = ? AND effective_to IS NULL`,
        [req.params.id]
      );
      // Insert new price
      await conn.execute(
        `INSERT INTO product_prices (id, product_id, price, currency, effective_from, effective_to, created_at)
         VALUES (?, ?, ?, 'UZS', NOW(3), NULL, NOW(3))`,
        [entityId('pp'), req.params.id, price]
      );
    });
    await auditReq(req, 'price_change', 'product', req.params.id, null, { newPrice: price });
    return ok(res, { productId: req.params.id, newPrice: price });
  } catch (err) { next(err); }
});

const variantSchema = z.object({
  name: z.string().min(1).max(100),
  priceDelta: z.number().min(-9999999).max(9999999).default(0),
});

productsRouter.post('/:id/variants', requirePerm('menu.manage'), validateBody(variantSchema), async (req, res, next) => {
  try {
    const { name, priceDelta } = req.body;
    const id = entityId('var');
    await pool.execute(
      `INSERT INTO product_variants (id, product_id, name, price_delta, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, req.params.id, name, priceDelta]
    );
    await auditReq(req, 'create_variant', 'product', req.params.id, null, { variantId: id, name, priceDelta });
    return created(res, { id, productId: req.params.id, name, priceDelta });
  } catch (err) { next(err); }
});
