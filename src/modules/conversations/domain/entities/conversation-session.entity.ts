import type { ConversationState } from '../conversation-state';
import type { ConversationStatus } from '../conversation-status';
import type { ConversationSessionContext } from './conversation-session-context.entity';

export interface ConversationSession {
  conversationKey: string;
  channel: 'whatsapp';
  participantPhone: string;
  phoneNumberId: string | null;
  state: ConversationState;
  status: ConversationStatus;
  context?: ConversationSessionContext;
  lastInboundAt?: string;
  idleReminderSentAt?: string;
  idleExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}
