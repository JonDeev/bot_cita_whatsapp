import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  SaveWebhookInboxEventInput,
  SaveWebhookInboxEventResult,
  UpdateWebhookInboxEventInput,
  WebhookInboxRepositoryPort,
} from '../../../domain/ports/webhook-inbox.repository.port';

@Injectable()
export class PrismaBotWebhookInboxRepository implements WebhookInboxRepositoryPort {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async saveIfFirstSeen(input: SaveWebhookInboxEventInput): Promise<SaveWebhookInboxEventResult> {
    try {
      await this.prismaBot.botWebhookEvent.create({
        data: {
          deduplicationKey: input.deduplicationKey,
          providerMessageId: input.providerMessageId,
          eventKind: input.eventKind,
          phoneNumberId: input.phoneNumberId,
          participantPhone: input.participantPhone,
          messageType: input.messageType,
          interactiveReplyId: input.interactiveReplyId,
          contextMessageId: input.contextMessageId,
          providerOccurredAt: new Date(input.providerOccurredAt),
          receivedAt: new Date(input.receivedAt),
          signatureValid: input.signatureValid,
          payloadHash: input.payloadHash,
          payload: input.payload ?? Prisma.JsonNull,
        },
      });

      return { created: true };
    } catch (error) {
      if (this.isDuplicateDeduplicationKey(error)) {
        return { created: false };
      }

      throw error;
    }
  }

  async updateStatus(input: UpdateWebhookInboxEventInput): Promise<void> {
    await this.prismaBot.botWebhookEvent.update({
      where: { deduplicationKey: input.deduplicationKey },
      data: {
        processingStatus: input.processingStatus,
        processedAt: new Date(input.processedAt),
        rejectionReason: input.rejectionReason ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  private isDuplicateDeduplicationKey(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    return prismaError.code === 'P2002';
  }
}
