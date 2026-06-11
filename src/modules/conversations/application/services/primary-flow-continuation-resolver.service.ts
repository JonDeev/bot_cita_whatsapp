import { Injectable } from '@nestjs/common';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';

@Injectable()
export class PrimaryFlowContinuationResolverService {
  shouldContinue(session: ConversationSession): boolean {
    const flowIntent = session.context?.flowIntent;

    return Boolean(flowIntent && flowIntent !== 'UPDATE_CONTACT');
  }
}
