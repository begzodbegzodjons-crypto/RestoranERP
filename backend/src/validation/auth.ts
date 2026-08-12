/**
 * Auth request/response schemas.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().min(3).max(30),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  password: z.string().min(6).max(100).optional(),
  deviceId: z.string().uuid().optional(),
}).refine(v => v.pin || v.password, {
  message: 'Either pin or password is required',
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;
