import type { ConversationSession } from '../entities/conversation-session.entity';

export interface ConversationPersistenceRepository {
  upsert(session: ConversationSession): Promise<void>;
}
