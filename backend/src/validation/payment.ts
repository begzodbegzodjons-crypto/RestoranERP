/**
 * Payment request/response schemas.
 */
import { z } from 'zod';
import { cuidSchema, currencySchema, idempotencyKeySchema } from './common';

export const payOrderSchema = z.object({
  orderId: cuidSchema,
  shiftId: cuidSchema.nullable().optional(),
  subtotal: currencySchema,
  discountAmount: currencySchema.default(0),
  discountType: z.enum(['amount', 'percent']).nullable().optional(),
  discountReason: z.string().max(200).nullable().optional(),
  taxAmount: currencySchema.default(0),
  tipAmount: currencySchema.default(0),
  totalPaid: currencySchema,
  changeAmount: currencySchema.default(0),
  paymentMethod: z.enum(['cash', 'click', 'payme', 'card', 'mixed']),
  cashAmount: currencySchema.default(0),
  cardAmount: currencySchema.default(0),
  clickAmount: currencySchema.default(0),
  paymeAmount: currencySchema.default(0),
  reference: z.string().max(100).nullable().optional(),
  idempotencyKey: idempotencyKeySchema,
  version: z.number().int().min(1),
  cashierPrinterId: cuidSchema,
}).refine(
  v => v.cashAmount + v.cardAmount + v.clickAmount + v.paymeAmount === v.totalPaid,
  { message: 'cash + card + click + payme must equal totalPaid', path: ['totalPaid'] }
);
export type PayOrderInput = z.infer<typeof payOrderSchema>;

export const listPaymentsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  method: z.enum(['cash', 'click', 'payme', 'card', 'mixed']).optional(),
  cashierId: cuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
