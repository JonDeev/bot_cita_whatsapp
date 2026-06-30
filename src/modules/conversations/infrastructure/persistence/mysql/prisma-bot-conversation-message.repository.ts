import { Injectable } from '@nestjs/common';
import { BotMessageDirection, Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  ConversationMessageRepository,
  SaveInboundConversationMessageInput,
  SaveOutboundConversationMessageInput,
  TemplateMessageSnapshot,
} from '../../../domain/ports/conversation-message.repository';

interface TemplateSnapshotTransportPayload {
  to: string;
  messageType: string;
  whatsappMessageId?: string;
}

type TemplateSnapshotPayload = Prisma.InputJsonObject & {
  kind: 'template_snapshot';
  templateName: string;
  templateLanguageCode: string;
  templateVariant: TemplateMessageSnapshot['templateVariant'];
  bodyTextParameters: string[];
  visibleButtons: Array<{ index: string; title: string }>;
  buttonPayloads: Array<{ index: string; payload: string }>;
  flowMetadata: TemplateMessageSnapshot['flowMetadata'] | null;
  snapshotVersion: string;
  renderedHash: string;
  transport: TemplateSnapshotTransportPayload;
};

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
    const body = this.resolveInboundBody(input);

    await this.prismaBot.botMessage.upsert({
      where: { whatsappMessageId: input.messageId },
      create: {
        conversationId,
        direction: BotMessageDirection.INBOUND,
        whatsappMessageId: input.messageId,
        messageType: input.messageType,
        body,
        payload,
        occurredAt,
        providerOccurredAt: occurredAt,
        receivedAt: new Date(input.receivedAt),
      },
      update: {
        conversationId,
        messageType: input.messageType,
        body,
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
    // Template snapshots own the visible copy; payload stays technical.
    const body = input.templateSnapshot?.visibleBody ?? this.resolveOutboundBody(input);
    const payload = this.buildOutboundPayload(input);

    if (input.whatsappMessageId) {
      await this.prismaBot.botMessage.upsert({
        where: { whatsappMessageId: input.whatsappMessageId },
        create: {
          conversationId,
          direction: BotMessageDirection.OUTBOUND,
          whatsappMessageId: input.whatsappMessageId,
          messageType: input.messageType,
          body,
          payload,
          occurredAt,
          sentAt: occurredAt,
        },
        update: {
          conversationId,
          messageType: input.messageType,
          body,
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
        body,
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

  private resolveInboundBody(input: SaveInboundConversationMessageInput): string | null {
    const normalizedText = this.normalizeVisibleText(input.textBody);
    if (normalizedText) {
      return normalizedText;
    }

    const interactiveTitle = this.normalizeVisibleText(input.interactiveReplyTitle);
    if (interactiveTitle) {
      return interactiveTitle;
    }

    const interactiveId = this.normalizeVisibleText(input.interactiveReplyId);
    return interactiveId;
  }

  private resolveOutboundBody(input: SaveOutboundConversationMessageInput): string | null {
    if (input.templateSnapshot?.visibleBody) {
      return input.templateSnapshot.visibleBody;
    }

    const normalizedText = this.normalizeVisibleText(input.body);
    if (normalizedText) {
      return normalizedText;
    }

    if (input.messageType === 'interactive') {
      return 'Mensaje interactivo';
    }

    return null;
  }

  private buildOutboundPayload(
    input: SaveOutboundConversationMessageInput,
  ): Prisma.InputJsonObject {
    if (!input.templateSnapshot) {
      return {
        to: input.to,
        messageType: input.messageType,
        body: input.body,
      };
    }

    const templateSnapshot = input.templateSnapshot;
    // Keep the observability snapshot structured and free of the visible body.
    const flowMetadata = templateSnapshot.flowMetadata
      ? {
          buttonIndex: templateSnapshot.flowMetadata.buttonIndex,
          ...(templateSnapshot.flowMetadata.ctaLabel
            ? {
                ctaLabel: templateSnapshot.flowMetadata.ctaLabel,
              }
            : {}),
          ...(templateSnapshot.flowMetadata.dispatchId
            ? {
                dispatchId: templateSnapshot.flowMetadata.dispatchId,
              }
            : {}),
          ...(templateSnapshot.flowMetadata.surveyDateIso
            ? {
                surveyDateIso: templateSnapshot.flowMetadata.surveyDateIso,
              }
            : {}),
        }
      : null;
    const payload: TemplateSnapshotPayload = {
      kind: 'template_snapshot',
      templateName: templateSnapshot.templateName,
      templateLanguageCode: templateSnapshot.templateLanguageCode,
      templateVariant: templateSnapshot.templateVariant,
      bodyTextParameters: [...templateSnapshot.bodyTextParameters],
      visibleButtons: templateSnapshot.visibleButtons.map((button) => ({
        index: button.index,
        title: button.title,
      })),
      buttonPayloads: (templateSnapshot.buttonPayloads ?? []).map((button) => ({
        index: button.index,
        payload: button.payload,
      })),
      flowMetadata,
      snapshotVersion: templateSnapshot.snapshotVersion,
      renderedHash: templateSnapshot.renderedHash,
      transport: {
        to: input.to,
        messageType: input.messageType,
        ...(input.whatsappMessageId
          ? { whatsappMessageId: input.whatsappMessageId }
          : {}),
      },
    };

    return payload;
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
