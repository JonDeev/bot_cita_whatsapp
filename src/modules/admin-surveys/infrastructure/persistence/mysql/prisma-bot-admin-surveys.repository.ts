import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminSurveysRepository,
  ListAdminSurveyDispatchesQuery,
} from '../../../domain/ports/admin-surveys.repository';

@Injectable()
export class PrismaBotAdminSurveysRepository implements AdminSurveysRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async listDispatches(query: ListAdminSurveyDispatchesQuery) {
    const where: Prisma.BotSurveyDispatchWhereInput = {};
    if (query.status) {
      where.status = query.status as never;
    }
    if (query.fromIso || query.toIso) {
      where.updatedAt = {};
      if (query.fromIso) {
        where.updatedAt.gte = new Date(query.fromIso);
      }
      if (query.toIso) {
        where.updatedAt.lte = new Date(query.toIso);
      }
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, items] = await Promise.all([
      this.prismaBot.botSurveyDispatch.count({ where }),
      this.prismaBot.botSurveyDispatch.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: items.map((item) => ({
        id: item.id,
        patientLegacyUserId: item.patientLegacyUserId,
        patientPhone: item.patientPhoneE164 ?? item.patientPhone,
        surveyDateIso: item.surveyDate.toISOString(),
        status: item.status,
        triggerType: item.triggerType,
        windowStartAtIso: item.windowStartAt.toISOString(),
        windowEndAtIso: item.windowEndAt.toISOString(),
        completedAtIso: item.completedAt?.toISOString() ?? null,
        failedAtIso: item.failedAt?.toISOString() ?? null,
        updatedAtIso: item.updatedAt.toISOString(),
      })),
    };
  }
}
