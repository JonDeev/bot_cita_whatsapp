import type { ConversationSession } from '../entities/conversation-session.entity';

export interface ConversationSessionRepository {
  findByKey(conversationKey: string): Promise<ConversationSession | null>;
  save(session: ConversationSession): Promise<void>;
}
