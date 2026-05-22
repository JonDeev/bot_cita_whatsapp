import { Injectable } from '@nestjs/common';
import { BotMessageDirection } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  ConversationMessageRepository,
  SaveInboundConversationMessageInput,
  SaveOutboundConversationMessageInput,
} from '../../../domain/ports/conversation-message.repository';

@Injectable()
export class PrismaBotConversationMessageRepository implements ConversationMessageRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async saveInbound(input: SaveInboundConversationMessageInput): Promise<void> {
    const conversationId = await this.ensureConversationId(
      input.conversationKey,
      input.from,
    );
    const occurredAt = this.fromUnixTimestamp(input.providerTimestamp);
    const payload = {
      phoneNumberId: input.phoneNumberId,
      textBody: input.textBody,
      interactiveReplyId: input.interactiveReplyId,
      interactiveReplyTitle: input.interactiveReplyTitle,
      contextMessageId: input.contextMessageId,
    };

    await this.prismaBot.botMessage.upsert({
      where: { whatsappMessageId: input.messageId },
      create: {
        conversationId,
        direction: BotMessageDirection.INBOUND,
        whatsappMessageId: input.messageId,
        messageType: input.messageType,
        body: input.textBody,
        payload,
        occurredAt,
        providerOccurredAt: occurredAt,
        receivedAt: new Date(input.receivedAt),
      },
      update: {
        conversationId,
        messageType: input.messageType,
        body: input.textBody,
        payload,
        occurredAt,
        providerOccurredAt: occurredAt,
        receivedAt: new Date(input.receivedAt),
      },
    });
  }

  async saveOutbound(
    input: SaveOutboundConversationMessageInput,
  ): Promise<void> {
    const conversationId = await this.ensureConversationId(
      input.conversationKey,
      input.to,
    );
    const occurredAt = new Date(input.sentAt);
    const payload = {
      to: input.to,
      messageType: input.messageType,
      body: input.body,
    };

    if (input.whatsappMessageId) {
      await this.prismaBot.botMessage.upsert({
        where: { whatsappMessageId: input.whatsappMessageId },
        create: {
          conversationId,
          direction: BotMessageDirection.OUTBOUND,
          whatsappMessageId: input.whatsappMessageId,
          messageType: input.messageType,
          body: input.body,
          payload,
          occurredAt,
          sentAt: occurredAt,
        },
        update: {
          conversationId,
          messageType: input.messageType,
          body: input.body,
          payload,
          occurredAt,
          sentAt: occurredAt,
        },
      });
      return;
    }

    await this.prismaBot.botMessage.create({
      data: {
        conversationId,
        direction: BotMessageDirection.OUTBOUND,
        messageType: input.messageType,
        body: input.body,
        payload,
        occurredAt,
        sentAt: occurredAt,
      },
    });
  }

  async hasKnownOutboundMessage(
    conversationKey: string,
    whatsappMessageId: string,
  ): Promise<boolean> {
    const message = await this.prismaBot.botMessage.findFirst({
      where: {
        whatsappMessageId,
        direction: BotMessageDirection.OUTBOUND,
        conversation: {
          conversationKey,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(message);
  }

  async findOutboundMessageOccurredAt(
    conversationKey: string,
    whatsappMessageId: string,
  ): Promise<string | null> {
    const message = await this.prismaBot.botMessage.findFirst({
      where: {
        whatsappMessageId,
        direction: BotMessageDirection.OUTBOUND,
        conversation: {
          conversationKey,
        },
      },
      select: {
        occurredAt: true,
      },
    });

    if (!message) {
      return null;
    }

    return message.occurredAt.toISOString();
  }

  private async ensureConversationId(
    conversationKey: string,
    participantPhone: string,
  ): Promise<number> {
    const conversation = await this.prismaBot.botConversation.upsert({
      where: { conversationKey },
      create: {
        conversationKey,
        channel: 'whatsapp',
        participantPhone,
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
      },
      update: {
        participantPhone,
      },
      select: { id: true },
    });

    return conversation.id;
  }

  private fromUnixTimestamp(timestamp: string): Date {
    const milliseconds = Number(timestamp) * 1000;
    if (!Number.isFinite(milliseconds)) {
      return new Date();
    }

    return new Date(milliseconds);
  }
}
