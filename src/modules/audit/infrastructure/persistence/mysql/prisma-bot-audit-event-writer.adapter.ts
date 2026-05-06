import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AuditEvent } from '../../../domain/audit-event';
import type { AuditEventWriterPort } from '../../../domain/ports/audit-event-writer.port';

@Injectable()
export class PrismaBotAuditEventWriterAdapter implements AuditEventWriterPort {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async write(event: AuditEvent): Promise<void> {
    const conversationKey = this.extractConversationKey(event);
    const conversationId = conversationKey
      ? await this.resolveConversationId(conversationKey)
      : null;

    await this.prismaBot.botAuditEvent.create({
      data: {
        action: event.action,
        conversationKey,
        conversationId,
        metadata: this.normalizeMetadata(event.metadata),
        occurredAt: new Date(event.occurredAt),
      },
    });
  }

  private extractConversationKey(event: AuditEvent): string | null {
    const value = event.metadata.conversationKey;
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    return value;
  }

  private async resolveConversationId(conversationKey: string): Promise<number | null> {
    const conversation = await this.prismaBot.botConversation.findUnique({
      where: { conversationKey },
      select: { id: true },
    });

    return conversation?.id ?? null;
  }

  private normalizeMetadata(
    metadata: AuditEvent['metadata'],
  ): Record<string, string | number | boolean | null> {
    const normalized: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) {
        continue;
      }

      normalized[key] = value;
    }

    return normalized;
  }
}
