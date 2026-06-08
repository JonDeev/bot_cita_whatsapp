import { BadRequestException, Injectable } from '@nestjs/common';
import { z, ZodError, type ZodType } from 'zod';
import type { ReminderRuntimeSettingsUpdateRequestDto } from '@whatsapp-bot/shared';
import type { ListAdminReminderDispatchesQuery } from '../../domain/ports/admin-reminders.repository';
import { adminReminderRuntimeSettingsUpdateRequestSchema } from './admin-reminder-runtime-settings-update-request.schema';

const listDispatchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const reminderMetricsSchema = z.object({
  lookbackHours: z.coerce.number().int().min(1).max(168).optional(),
});

const reminderSettingsHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const reminderEmergencyPauseRequestSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    enabled: z.boolean(),
  })
  .strict();

@Injectable()
export class AdminRemindersQueryParserService {
  parseMetricsLookbackHours(raw: unknown): number | undefined {
    const parsed = this.parseOrThrow(reminderMetricsSchema, { lookbackHours: raw });
    return parsed.lookbackHours;
  }

  parseListDispatchesQuery(raw: unknown): ListAdminReminderDispatchesQuery {
    const parsed = this.parseOrThrow(listDispatchesSchema, raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      status: parsed.status ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }

  parseReminderRuntimeSettingsUpdateRequest(
    raw: unknown,
  ): ReminderRuntimeSettingsUpdateRequestDto {
    return this.parseOrThrow(adminReminderRuntimeSettingsUpdateRequestSchema, raw);
  }

  parseEmergencyPauseRequest(raw: unknown): {
    expectedVersion: number;
    reason: string;
    enabled: boolean;
  } {
    return this.parseOrThrow(reminderEmergencyPauseRequestSchema, raw);
  }

  parseReminderSettingsHistoryQuery(raw: unknown): {
    page: number;
    pageSize: number;
  } {
    const parsed = this.parseOrThrow(reminderSettingsHistoryQuerySchema, raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
    };
  }

  private parseOrThrow<T>(schema: ZodType<T>, raw: unknown): T {
    try {
      return schema.parse(raw);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Invalid admin reminders request.',
          issues: error.flatten(),
        });
      }

      throw error;
    }
  }
}
