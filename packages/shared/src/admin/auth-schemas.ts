import { z } from 'zod';

export const AdminUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/);

export const AdminLoginIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(191);

export const AdminLoginRequestSchema = z.object({
  identifier: AdminLoginIdentifierSchema,
  password: z.string().min(1).max(512),
});

export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
