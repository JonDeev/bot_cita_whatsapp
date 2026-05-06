import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { ConversationSession } from '../../../domain/entities/conversation-session.entity';
import type { ConversationPersistenceRepository } from '../../../domain/ports/conversation-persistence.repository';

@Injectable()
export class PrismaBotConversationPersistenceRepository implements ConversationPersistenceRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

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
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      },
      update: {
        participantPhone: session.participantPhone,
        phoneNumberId: session.phoneNumberId,
        state: session.state,
        status: session.status,
        updatedAt: new Date(session.updatedAt),
      },
    });
  }
}
