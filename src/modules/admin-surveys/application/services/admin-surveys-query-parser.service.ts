import { BadRequestException, Injectable } from '@nestjs/common';
import { z, ZodError, type ZodType } from 'zod';
import {
  SurveyEmergencyPauseUpdateRequestSchema,
  SurveyRuntimeSettingsUpdateRequestSchema,
} from '@whatsapp-bot/shared';
import type { ListAdminSurveyDispatchesQuery } from '../../domain/ports/admin-surveys.repository';

const listDispatchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const surveySettingsHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(8).optional(),
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

  parseSurveyRuntimeSettingsUpdateRequest(raw: unknown) {
    return this.parseOrThrow(SurveyRuntimeSettingsUpdateRequestSchema, raw);
  }

  parseSurveyEmergencyPauseRequest(raw: unknown) {
    return this.parseOrThrow(SurveyEmergencyPauseUpdateRequestSchema, raw);
  }

  parseSurveySettingsHistoryQuery(raw: unknown): { limit: number } {
    const parsed = this.parseOrThrow(surveySettingsHistoryQuerySchema, raw);
    return {
      limit: parsed.limit ?? 8,
    };
  }

  private parseOrThrow<T>(schema: ZodType<T>, raw: unknown): T {
    try {
      return schema.parse(raw);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Invalid admin surveys request.',
          issues: error.flatten(),
        });
      }

      throw error;
    }
  }
}
