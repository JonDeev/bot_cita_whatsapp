import { Injectable } from '@nestjs/common';
import { BotOutboxStatus, Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AppointmentReminderOutboxRepository } from '../../../domain/ports/appointment-reminder-outbox.repository';

@Injectable()
export class PrismaBotAppointmentReminderOutboxRepository implements AppointmentReminderOutboxRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async reserve(input: {
    deduplicationKey: string;
    conversationKey: string;
    recipientPhone: string;
    payload: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prismaBot.botOutboxMessage.upsert({
      where: { deduplicationKey: input.deduplicationKey },
      create: {
        channel: 'whatsapp',
        recipientPhone: input.recipientPhone,
        payload: input.payload,
        deduplicationKey: input.deduplicationKey,
        status: BotOutboxStatus.PENDING,
      },
      update: {
        recipientPhone: input.recipientPhone,
        payload: input.payload,
        status: BotOutboxStatus.PENDING,
        nextAttemptAt: null,
        sentAt: null,
        failedAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markSent(input: {
    deduplicationKey: string;
    payload: Prisma.InputJsonValue;
    sentAtIso: string;
  }): Promise<void> {
    await this.prismaBot.botOutboxMessage.updateMany({
      where: { deduplicationKey: input.deduplicationKey },
      data: {
        status: BotOutboxStatus.SENT,
        sentAt: new Date(input.sentAtIso),
        payload: input.payload,
        failedAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markFailed(input: {
    deduplicationKey: string;
    errorMessage: string;
  }): Promise<void> {
    await this.prismaBot.botOutboxMessage.updateMany({
      where: { deduplicationKey: input.deduplicationKey },
      data: {
        status: BotOutboxStatus.FAILED,
        failedAt: new Date(),
        errorCode: 'REMINDER_OUTBOUND_FAILURE',
        errorMessage: input.errorMessage,
      },
    });
  }
}
