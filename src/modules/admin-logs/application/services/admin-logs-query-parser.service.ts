import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ListAdminAuditQuery,
  ListAdminEventsQuery,
  ListAdminFailuresQuery,
} from '../../domain/ports/admin-logs.repository';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const listEventsSchema = paginationSchema.extend({
  action: z.string().trim().min(1).max(128).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const listFailuresSchema = paginationSchema.extend({
  source: z.enum(['OUTBOX', 'WEBHOOK']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const listAuditSchema = paginationSchema.extend({
  action: z.string().trim().min(1).max(128).optional(),
  adminUserId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

@Injectable()
export class AdminLogsQueryParserService {
  parseEventsQuery(raw: unknown): ListAdminEventsQuery {
    const parsed = listEventsSchema.parse(raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      action: parsed.action ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }

  parseFailuresQuery(raw: unknown): ListAdminFailuresQuery {
    const parsed = listFailuresSchema.parse(raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      source: parsed.source ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }

  parseAuditQuery(raw: unknown): ListAdminAuditQuery {
    const parsed = listAuditSchema.parse(raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      action: parsed.action ?? null,
      adminUserId: parsed.adminUserId ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }
}
