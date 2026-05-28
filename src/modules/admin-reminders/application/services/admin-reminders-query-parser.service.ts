import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ListAdminReminderDispatchesQuery } from '../../domain/ports/admin-reminders.repository';

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

@Injectable()
export class AdminRemindersQueryParserService {
  parseMetricsLookbackHours(raw: unknown): number | undefined {
    const parsed = reminderMetricsSchema.parse({ lookbackHours: raw });
    return parsed.lookbackHours;
  }

  parseListDispatchesQuery(raw: unknown): ListAdminReminderDispatchesQuery {
    const parsed = listDispatchesSchema.parse(raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      status: parsed.status ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }
}
