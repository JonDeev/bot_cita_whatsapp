import type { ConversationSession } from '../entities/conversation-session.entity';

export interface ConversationPersistenceRepository {
  findByKey(conversationKey: string): Promise<ConversationSession | null>;
  upsert(session: ConversationSession): Promise<void>;
}
