import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import {
  CONVERSATION_PERSISTENCE_REPOSITORY,
  CONVERSATION_SESSION_REPOSITORY,
} from '../../domain/conversations.tokens';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationPersistenceRepository } from '../../domain/ports/conversation-persistence.repository';
import type { ConversationSessionRepository } from '../../domain/ports/conversation-session.repository';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import { ConversationNavigationService } from '../services/conversation-navigation.service';
import { ConversationStatePromptService } from '../services/conversation-state-prompt.service';
import { InteractivePromptWindowService } from '../services/interactive-prompt-window.service';
import { ConversationIdlePolicyConfigService } from '../services/conversation-idle-policy-config.service';

export interface ReconcileConversationIdlePolicyResult {
  remindersToDispatch: Array<{
    session: ConversationSession;
    outboundMessages: ConversationOutboundMessage[];
  }>;
  expiredCount: number;
}

@Injectable()
export class ReconcileConversationIdlePolicyUseCase {
  constructor(
    @Inject(CONVERSATION_PERSISTENCE_REPOSITORY)
    private readonly conversationPersistenceRepository: ConversationPersistenceRepository,
    @Inject(CONVERSATION_SESSION_REPOSITORY)
    private readonly conversationSessionRepository: ConversationSessionRepository,
    private readonly configService: ConversationIdlePolicyConfigService,
    private readonly conversationStatePromptService: ConversationStatePromptService,
    private readonly conversationNavigationService: ConversationNavigationService,
    private readonly interactivePromptWindowService: InteractivePromptWindowService,
    private readonly auditService: AuditService,
  ) {}

  async execute(nowIso: string): Promise<ReconcileConversationIdlePolicyResult> {
    if (!this.configService.isEnabled()) {
      return { remindersToDispatch: [], expiredCount: 0 };
    }

    if (
      !this.conversationPersistenceRepository
        .findBotActiveConversationsDueForExpiration ||
      !this.conversationPersistenceRepository
        .findBotActiveConversationsDueForIdleReminder
    ) {
      return { remindersToDispatch: [], expiredCount: 0 };
    }

    const batchSize = this.configService.getBatchSize();
    const expiredSessions =
      await this.conversationPersistenceRepository.findBotActiveConversationsDueForExpiration(
        nowIso,
        batchSize,
      );

    let expiredCount = 0;
    for (const session of expiredSessions) {
      const expiredSession: ConversationSession = {
        ...session,
        status: CONVERSATION_STATUSES.EXPIRED,
        context: this.interactivePromptWindowService.clear(session.context),
        idleReminderSentAt: undefined,
        updatedAt: nowIso,
      };
      await this.persistSession(expiredSession);
      expiredCount += 1;

      await this.auditService.record('conversation.expired.by_inactivity', {
        conversationKey: session.conversationKey,
        previousState: session.state,
        previousStatus: session.status,
      });
    }

    const reminderThresholdAt = new Date(
      Date.parse(nowIso) -
        this.configService.getReminderAfterMinutes() * 60 * 1000,
    ).toISOString();
    const reminderSessions =
      await this.conversationPersistenceRepository.findBotActiveConversationsDueForIdleReminder(
        reminderThresholdAt,
        nowIso,
        batchSize,
      );

    const remindersToDispatch: ReconcileConversationIdlePolicyResult['remindersToDispatch'] =
      [];
    for (const session of reminderSessions) {
      if (session.status !== CONVERSATION_STATUSES.BOT_ACTIVE) {
        continue;
      }

      const promptResult = this.conversationStatePromptService.buildForState(
        session,
        session.state,
      );
      const outboundMessages = this.appendNavigationButtons(
        promptResult.nextState,
        promptResult.outboundMessages,
      );
      const reminderSession: ConversationSession = {
        ...session,
        idleReminderSentAt: nowIso,
        updatedAt: nowIso,
      };
      await this.persistSession(reminderSession);

      await this.auditService.record('conversation.idle.reminder.sent', {
        conversationKey: session.conversationKey,
        state: session.state,
      });

      remindersToDispatch.push({
        session: reminderSession,
        outboundMessages: [
          {
            type: 'text',
            body: 'Seguimos aqui para ayudarte. Si deseas continuar, te envio nuevamente el paso actual.',
          },
          ...outboundMessages,
        ],
      });
    }

    return { remindersToDispatch, expiredCount };
  }

  private appendNavigationButtons(
    state: ConversationSession['state'],
    outboundMessages: ConversationOutboundMessage[],
  ): ConversationOutboundMessage[] {
    if (outboundMessages.length === 0 || state === CONVERSATION_STATES.MAIN_MENU) {
      return outboundMessages;
    }

    if (
      outboundMessages.some((message) => message.type === 'interactive_buttons')
    ) {
      return outboundMessages;
    }

    const navigationMessage =
      this.conversationNavigationService.buildNavigationMessage(state);
    if (!navigationMessage) {
      return outboundMessages;
    }

    return [...outboundMessages, navigationMessage];
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    await this.conversationSessionRepository.save(session);
    await this.conversationPersistenceRepository.upsert(session);
  }
}
