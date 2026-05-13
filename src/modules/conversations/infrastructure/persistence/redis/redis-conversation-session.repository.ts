import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../../shared/infrastructure/redis/redis.service';
import type { ConversationSession } from '../../../domain/entities/conversation-session.entity';
import type { ConversationSessionRepository } from '../../../domain/ports/conversation-session.repository';
import { ConversationConfigService } from '../../../application/services/conversation-config.service';

@Injectable()
export class RedisConversationSessionRepository implements ConversationSessionRepository {
  private static readonly KEY_PREFIX = 'conversations:session:';
  private readonly logger = new Logger(RedisConversationSessionRepository.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly conversationConfigService: ConversationConfigService,
  ) {}

  async findByKey(
    conversationKey: string,
  ): Promise<ConversationSession | null> {
    const payload = await this.redisService.get(
      this.buildStorageKey(conversationKey),
    );
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload) as ConversationSession;
    } catch (error) {
      this.logger.error(
        `Failed to parse conversation session for key ${conversationKey}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async save(session: ConversationSession): Promise<void> {
    await this.redisService.set(
      this.buildStorageKey(session.conversationKey),
      JSON.stringify(session),
      this.conversationConfigService.getSessionTtlSeconds(),
    );
  }

  private buildStorageKey(conversationKey: string): string {
    return `${RedisConversationSessionRepository.KEY_PREFIX}${conversationKey}`;
  }
}
