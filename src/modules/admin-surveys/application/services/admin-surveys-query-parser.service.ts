import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ListAdminSurveyDispatchesQuery } from '../../domain/ports/admin-surveys.repository';

const listDispatchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

@Injectable()
export class AdminSurveysQueryParserService {
  parseListDispatchesQuery(raw: unknown): ListAdminSurveyDispatchesQuery {
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
