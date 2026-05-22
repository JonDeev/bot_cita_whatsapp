import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { ConversationSession } from '../../../domain/entities/conversation-session.entity';
import type { ConversationPersistenceRepository } from '../../../domain/ports/conversation-persistence.repository';

@Injectable()
export class PrismaBotConversationPersistenceRepository implements ConversationPersistenceRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async findByKey(
    conversationKey: string,
  ): Promise<ConversationSession | null> {
    const conversation = await this.prismaBot.botConversation.findUnique({
      where: { conversationKey },
    });

    if (!conversation) {
      return null;
    }

    return {
      conversationKey: conversation.conversationKey,
      channel: 'whatsapp',
      participantPhone: conversation.participantPhone,
      phoneNumberId: conversation.phoneNumberId,
      state: conversation.state as ConversationSession['state'],
      status: conversation.status as ConversationSession['status'],
      context:
        (conversation.context as ConversationSession['context'] | null) ??
        undefined,
      lastInboundAt: conversation.lastInboundAt?.toISOString(),
      idleReminderSentAt: conversation.idleReminderSentAt?.toISOString(),
      idleExpiresAt: conversation.idleExpiresAt?.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async upsert(session: ConversationSession): Promise<void> {
    await this.prismaBot.botConversation.upsert({
      where: { conversationKey: session.conversationKey },
      create: {
        conversationKey: session.conversationKey,
        channel: session.channel,
        participantPhone: session.participantPhone,
        phoneNumberId: session.phoneNumberId,
        state: session.state,
        status: session.status,
        context: this.serializeContext(session.context),
        lastInboundAt: session.lastInboundAt
          ? new Date(session.lastInboundAt)
          : null,
        idleReminderSentAt: session.idleReminderSentAt
          ? new Date(session.idleReminderSentAt)
          : null,
        idleExpiresAt: session.idleExpiresAt
          ? new Date(session.idleExpiresAt)
          : null,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      },
      update: {
        participantPhone: session.participantPhone,
        phoneNumberId: session.phoneNumberId,
        state: session.state,
        status: session.status,
        context: this.serializeContext(session.context),
        lastInboundAt: session.lastInboundAt
          ? new Date(session.lastInboundAt)
          : null,
        idleReminderSentAt: session.idleReminderSentAt
          ? new Date(session.idleReminderSentAt)
          : null,
        idleExpiresAt: session.idleExpiresAt
          ? new Date(session.idleExpiresAt)
          : null,
        updatedAt: new Date(session.updatedAt),
      },
    });
  }

  async findBotActiveConversationsDueForIdleReminder(
    reminderThresholdAt: string,
    nowIso: string,
    limit: number,
  ): Promise<ConversationSession[]> {
    const conversations = await this.prismaBot.botConversation.findMany({
      where: {
        status: 'BOT_ACTIVE',
        lastInboundAt: {
          lte: new Date(reminderThresholdAt),
        },
        idleExpiresAt: {
          gt: new Date(nowIso),
        },
        OR: [
          {
            idleReminderSentAt: null,
          },
          {
            idleReminderSentAt: {
              lt: new Date(reminderThresholdAt),
            },
          },
        ],
      },
      take: limit,
      orderBy: {
        lastInboundAt: 'asc',
      },
    });

    return conversations.map((conversation) => ({
      conversationKey: conversation.conversationKey,
      channel: 'whatsapp',
      participantPhone: conversation.participantPhone,
      phoneNumberId: conversation.phoneNumberId,
      state: conversation.state as ConversationSession['state'],
      status: conversation.status as ConversationSession['status'],
      context:
        (conversation.context as ConversationSession['context'] | null) ??
        undefined,
      lastInboundAt: conversation.lastInboundAt?.toISOString(),
      idleReminderSentAt: conversation.idleReminderSentAt?.toISOString(),
      idleExpiresAt: conversation.idleExpiresAt?.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    }));
  }

  async findBotActiveConversationsDueForExpiration(
    nowIso: string,
    limit: number,
  ): Promise<ConversationSession[]> {
    const conversations = await this.prismaBot.botConversation.findMany({
      where: {
        status: 'BOT_ACTIVE',
        idleExpiresAt: {
          lte: new Date(nowIso),
        },
      },
      take: limit,
      orderBy: {
        idleExpiresAt: 'asc',
      },
    });

    return conversations.map((conversation) => ({
      conversationKey: conversation.conversationKey,
      channel: 'whatsapp',
      participantPhone: conversation.participantPhone,
      phoneNumberId: conversation.phoneNumberId,
      state: conversation.state as ConversationSession['state'],
      status: conversation.status as ConversationSession['status'],
      context:
        (conversation.context as ConversationSession['context'] | null) ??
        undefined,
      lastInboundAt: conversation.lastInboundAt?.toISOString(),
      idleReminderSentAt: conversation.idleReminderSentAt?.toISOString(),
      idleExpiresAt: conversation.idleExpiresAt?.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    }));
  }

  private serializeContext(
    context: ConversationSession['context'],
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (!context) {
      return Prisma.JsonNull;
    }

    return context as unknown as Prisma.InputJsonValue;
  }
}
