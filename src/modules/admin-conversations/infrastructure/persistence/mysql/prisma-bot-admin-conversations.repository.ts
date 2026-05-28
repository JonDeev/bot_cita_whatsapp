import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminConversationsRepository,
  ListAdminConversationMessagesQuery,
  ListAdminConversationsQuery,
} from '../../../domain/ports/admin-conversations.repository';

@Injectable()
export class PrismaBotAdminConversationsRepository
  implements AdminConversationsRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async listConversations(query: ListAdminConversationsQuery) {
    const where = this.buildConversationWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, conversations] = await Promise.all([
      this.prismaBot.botConversation.count({ where }),
      this.prismaBot.botConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
        include: {
          messages: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: {
              direction: true,
              messageType: true,
              body: true,
              payload: true,
              occurredAt: true,
            },
          },
        },
      }),
    ]);

    return {
      items: conversations.map((conversation) => {
        const lastMessage = conversation.messages[0];
        return {
          id: conversation.id,
          conversationKey: conversation.conversationKey,
          participantPhone: conversation.participantPhone,
          state: conversation.state,
          status: conversation.status,
          lastInboundAtIso: conversation.lastInboundAt?.toISOString() ?? null,
          updatedAtIso: conversation.updatedAt.toISOString(),
          lastMessageDirection: lastMessage?.direction ?? null,
          lastMessageType: lastMessage?.messageType ?? null,
          lastMessageBody: this.resolveMessageDisplayBody(
            lastMessage?.messageType ?? null,
            lastMessage?.body ?? null,
            lastMessage?.payload ?? null,
          ),
          lastMessageOccurredAtIso: lastMessage?.occurredAt.toISOString() ?? null,
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findConversationById(conversationId: number) {
    const conversation = await this.prismaBot.botConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      conversationKey: conversation.conversationKey,
      channel: conversation.channel,
      participantPhone: conversation.participantPhone,
      state: conversation.state,
      status: conversation.status,
      lastInboundAtIso: conversation.lastInboundAt?.toISOString() ?? null,
      idleExpiresAtIso: conversation.idleExpiresAt?.toISOString() ?? null,
      createdAtIso: conversation.createdAt.toISOString(),
      updatedAtIso: conversation.updatedAt.toISOString(),
    };
  }

  async listConversationMessages(query: ListAdminConversationMessagesQuery) {
    const skip = (query.page - 1) * query.pageSize;

    const [total, messages] = await Promise.all([
      this.prismaBot.botMessage.count({
        where: { conversationId: query.conversationId },
      }),
      this.prismaBot.botMessage.findMany({
        where: { conversationId: query.conversationId },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          direction: true,
          whatsappMessageId: true,
          messageType: true,
          body: true,
          payload: true,
          occurredAt: true,
        },
      }),
    ]);

    return {
      items: messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        whatsappMessageId: message.whatsappMessageId,
        messageType: message.messageType,
        body: this.resolveMessageDisplayBody(
          message.messageType,
          message.body,
          message.payload,
        ),
        payload: message.payload,
        occurredAtIso: message.occurredAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private buildConversationWhere(
    query: ListAdminConversationsQuery,
  ): Prisma.BotConversationWhereInput {
    const where: Prisma.BotConversationWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.participantPhoneContains) {
      where.participantPhone = {
        contains: query.participantPhoneContains,
      };
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

    return where;
  }

  private resolveMessageDisplayBody(
    messageType: string | null,
    body: string | null,
    payload: unknown,
  ): string | null {
    const normalizedBody = this.normalizeVisibleText(body);
    if (normalizedBody) {
      return normalizedBody;
    }

    if (messageType !== 'interactive') {
      return null;
    }

    const payloadObject = this.extractPayloadObject(payload);
    const interactiveTitle = this.normalizeVisibleText(
      this.readPayloadString(payloadObject, 'interactiveReplyTitle'),
    );
    const interactiveId = this.normalizeVisibleText(
      this.readPayloadString(payloadObject, 'interactiveReplyId'),
    );

    if (interactiveTitle && interactiveId) {
      return `${interactiveTitle} (${interactiveId})`;
    }

    if (interactiveTitle) {
      return interactiveTitle;
    }

    if (interactiveId) {
      return interactiveId;
    }

    return 'Mensaje interactivo';
  }

  private extractPayloadObject(
    payload: unknown,
  ): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as Record<string, unknown>;
  }

  private readPayloadString(
    payload: Record<string, unknown> | null,
    key: string,
  ): string | null {
    if (!payload) {
      return null;
    }

    const value = payload[key];
    return typeof value === 'string' ? value : null;
  }

  private normalizeVisibleText(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const withoutInvisibleChars = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
    const trimmed = withoutInvisibleChars.trim();

    return trimmed.length > 0 ? trimmed : null;
  }
}
