import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AdminLiveFeedItem } from '../../../domain/admin-overview.types';
import type {
  AdminOverviewAggregateCounts,
  AdminOverviewRepository,
} from '../../../domain/ports/admin-overview.repository';

@Injectable()
export class PrismaBotAdminOverviewRepository implements AdminOverviewRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async getAggregateCounts(windowStart: Date): Promise<AdminOverviewAggregateCounts> {
    const [
      inboundMessages,
      outboundMessages,
      outboxFailed,
      webhookFailed,
      activeConversations,
      reminderGroups,
      surveyGroups,
    ] = await Promise.all([
      this.prismaBot.botMessage.count({
        where: {
          direction: 'INBOUND',
          occurredAt: { gte: windowStart },
        },
      }),
      this.prismaBot.botMessage.count({
        where: {
          direction: 'OUTBOUND',
          occurredAt: { gte: windowStart },
        },
      }),
      this.prismaBot.botOutboxMessage.count({
        where: {
          status: 'FAILED',
          updatedAt: { gte: windowStart },
        },
      }),
      this.prismaBot.botWebhookEvent.count({
        where: {
          processingStatus: 'FAILED',
          updatedAt: { gte: windowStart },
        },
      }),
      this.prismaBot.botConversation.count({
        where: {
          status: {
            in: ['BOT_ACTIVE', 'HUMAN_HANDOFF'],
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prismaBot.botSurveyDispatch.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      inboundMessages,
      outboundMessages,
      outboxFailed,
      webhookFailed,
      activeConversations,
      reminderDispatches: reminderGroups.map((group) => ({
        status: group.status,
        count: group._count.status,
      })),
      surveyDispatches: surveyGroups.map((group) => ({
        status: group.status,
        count: group._count.status,
      })),
    };
  }

  async getRecentLiveFeed(windowStart: Date, limit: number): Promise<AdminLiveFeedItem[]> {
    const perSourceLimit = Math.max(10, Math.ceil(limit / 3));

    const [messageEvents, failureEvents, reminderAndSurveyEvents] = await Promise.all([
      this.getMessageEvents(windowStart, perSourceLimit),
      this.getFailureEvents(windowStart, perSourceLimit),
      this.getReminderAndSurveyEvents(windowStart, perSourceLimit),
    ]);

    return [...messageEvents, ...failureEvents, ...reminderAndSurveyEvents]
      .sort((left, right) =>
        right.occurredAtIso.localeCompare(left.occurredAtIso),
      )
      .slice(0, limit);
  }

  private async getMessageEvents(
    windowStart: Date,
    limit: number,
  ): Promise<AdminLiveFeedItem[]> {
    const messages = await this.prismaBot.botMessage.findMany({
      where: {
        direction: { in: ['INBOUND', 'OUTBOUND'] },
        occurredAt: { gte: windowStart },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        messageType: true,
        occurredAt: true,
        conversationId: true,
      },
    });

    return messages.map((message) => ({
      eventId: `message-${message.id}`,
      eventType:
        message.direction === 'INBOUND' ? 'message.inbound' : 'message.outbound',
      occurredAtIso: message.occurredAt.toISOString(),
      severity: 'info',
      summary: `Mensaje ${message.direction.toLowerCase()} (${message.messageType})`,
      conversationId: message.conversationId,
    }));
  }

  private async getFailureEvents(
    windowStart: Date,
    limit: number,
  ): Promise<AdminLiveFeedItem[]> {
    const [outbox, webhook] = await Promise.all([
      this.prismaBot.botOutboxMessage.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { gte: windowStart },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          updatedAt: true,
          conversationId: true,
        },
      }),
      this.prismaBot.botWebhookEvent.findMany({
        where: {
          processingStatus: 'FAILED',
          updatedAt: { gte: windowStart },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          updatedAt: true,
        },
      }),
    ]);

    const outboxItems: AdminLiveFeedItem[] = outbox.map((item) => ({
      eventId: `outbox-failed-${item.id}`,
      eventType: 'outbox.failed',
      occurredAtIso: item.updatedAt.toISOString(),
      severity: 'error',
      summary: 'Fallo de envio en outbox.',
      conversationId: item.conversationId,
    }));

    const webhookItems: AdminLiveFeedItem[] = webhook.map((item) => ({
      eventId: `webhook-failed-${item.id}`,
      eventType: 'webhook.failed',
      occurredAtIso: item.updatedAt.toISOString(),
      severity: 'error',
      summary: 'Fallo de procesamiento de webhook.',
      conversationId: null,
    }));

    return [...outboxItems, ...webhookItems];
  }

  private async getReminderAndSurveyEvents(
    windowStart: Date,
    limit: number,
  ): Promise<AdminLiveFeedItem[]> {
    const [reminders, surveys] = await Promise.all([
      this.prismaBot.botAppointmentReminderDispatch.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { gte: windowStart },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          updatedAt: true,
        },
      }),
      this.prismaBot.botSurveyDispatch.findMany({
        where: {
          status: 'COMPLETED',
          updatedAt: { gte: windowStart },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          updatedAt: true,
        },
      }),
    ]);

    const reminderItems: AdminLiveFeedItem[] = reminders.map((item) => ({
      eventId: `reminder-failed-${item.id}`,
      eventType: 'reminder.failed',
      occurredAtIso: item.updatedAt.toISOString(),
      severity: 'warning',
      summary: 'Recordatorio fallo durante el despacho.',
      conversationId: null,
    }));

    const surveyItems: AdminLiveFeedItem[] = surveys.map((item) => ({
      eventId: `survey-completed-${item.id}`,
      eventType: 'survey.completed',
      occurredAtIso: item.updatedAt.toISOString(),
      severity: 'info',
      summary: 'Encuesta completada por paciente.',
      conversationId: null,
    }));

    return [...reminderItems, ...surveyItems];
  }
}
