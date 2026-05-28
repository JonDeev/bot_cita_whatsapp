import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AdminLoginRequestDto } from '@whatsapp-bot/shared';

const adminUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/);

const adminLoginRequestSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(3).max(191),
  password: z.string().min(1).max(512),
});

@Injectable()
export class AdminIdentifierNormalizerService {
  parseLoginRequest(body: unknown): AdminLoginRequestDto {
    return adminLoginRequestSchema.parse(body);
  }

  normalizeIdentifier(value: string): string {
    return value.trim().toLowerCase();
  }

  normalizeUsername(value: string): string {
    return adminUsernameSchema.parse(value);
  }

  normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  isEmailIdentifier(identifier: string): boolean {
    return identifier.includes('@');
  }
}
