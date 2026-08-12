/**
 * Common schemas reused across endpoints.
 */
import { z } from 'zod';

export const cuidSchema = z.string().min(10).max(28);
export const uuidSchema = z.string().uuid();
export const phoneSchema = z.string().regex(/^\+998\d{9}$/).or(z.literal(''));
export const currencySchema = z.number().min(0).max(9999999999.99);
export const quantitySchema = z.number().min(0).max(99999);
export const idempotencyKeySchema = z.string().uuid().or(z.string().min(32).max(64));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const orderStatusSchema = z.enum(['open', 'cooking', 'ready', 'paid', 'cancelled']);
export const paymentStatusSchema = z.enum(['unpaid', 'partial', 'paid', 'refunded']);
export const paymentMethodSchema = z.enum(['cash', 'click', 'payme', 'card', 'mixed']);
export const stationSchema = z.enum(['kitchen', 'kebab', 'bar', 'other']);
export const itemStatusSchema = z.enum(['pending', 'cooking', 'ready', 'served', 'cancelled']);
