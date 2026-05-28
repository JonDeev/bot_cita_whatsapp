import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminRemindersRepository,
  ListAdminReminderDispatchesQuery,
} from '../../../domain/ports/admin-reminders.repository';

@Injectable()
export class PrismaBotAdminRemindersRepository implements AdminRemindersRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async listDispatches(query: ListAdminReminderDispatchesQuery) {
    const where: Prisma.BotAppointmentReminderDispatchWhereInput = {};
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
      this.prismaBot.botAppointmentReminderDispatch.count({ where }),
      this.prismaBot.botAppointmentReminderDispatch.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        legacyAgendaId: item.legacyAgendaId,
        patientLegacyUserId: item.patientLegacyUserId,
        recipientPhoneRaw: item.recipientPhoneRaw,
        recipientPhoneE164: item.recipientPhoneE164,
        reminderType: item.reminderType,
        status: item.status,
        attempts: item.attempts,
        scheduledForIso: item.scheduledFor.toISOString(),
        sentAtIso: item.sentAt?.toISOString() ?? null,
        updatedAtIso: item.updatedAt.toISOString(),
        lastError: item.lastError,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
