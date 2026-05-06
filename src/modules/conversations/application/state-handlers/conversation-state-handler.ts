import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationState } from '../../domain/conversation-state';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import type { ConversationStatus } from '../../domain/conversation-status';
import type { ConversationSessionContext } from '../../domain/entities/conversation-session-context.entity';

export interface ConversationStateHandlerResult {
  nextState: ConversationState;
  nextStatus?: ConversationStatus;
  nextContext?: ConversationSessionContext;
  outboundMessages: ConversationOutboundMessage[];
}

export interface ConversationStateHandler {
  readonly state: ConversationState;
  handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult>;
}
