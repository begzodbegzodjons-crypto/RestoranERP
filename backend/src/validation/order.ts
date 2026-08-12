/**
 * Order request/response schemas.
 */
import { z } from 'zod';
import { cuidSchema, currencySchema, quantitySchema, idempotencyKeySchema } from './common';

export const createOrderItemSchema = z.object({
  productId: cuidSchema,
  variantId: cuidSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  unitPrice: currencySchema,
  costPrice: currencySchema.default(0),
  quantity: quantitySchema,
  notes: z.string().max(255).nullable().optional(),
  station: z.enum(['kitchen', 'kebab', 'bar', 'other']).default('kitchen'),
});
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

export const createOrderSchema = z.object({
  tableId: cuidSchema.nullable().optional(),
  waiterId: cuidSchema.nullable().optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']).default('dine_in'),
  customerName: z.string().max(150).nullable().optional(),
  customerPhone: z.string().max(30).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(createOrderItemSchema).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const addOrderItemSchema = createOrderItemSchema;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;

export const cancelOrderItemSchema = z.object({
  reason: z.string().min(1).max(200),
});
export type CancelOrderItemInput = z.infer<typeof cancelOrderItemSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const listOrdersQuerySchema = z.object({
  status: z.enum(['open', 'cooking', 'ready', 'paid', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  tableId: cuidSchema.optional(),
  waiterId: cuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
