import type { ConversationSession } from '../entities/conversation-session.entity';

export interface ConversationPersistenceRepository {
  findByKey(conversationKey: string): Promise<ConversationSession | null>;
  upsert(session: ConversationSession): Promise<void>;
  findBotActiveConversationsDueForIdleReminder?(
    reminderThresholdAt: string,
    nowIso: string,
    limit: number,
  ): Promise<ConversationSession[]>;
  findBotActiveConversationsDueForExpiration?(
    nowIso: string,
    limit: number,
  ): Promise<ConversationSession[]>;
}
