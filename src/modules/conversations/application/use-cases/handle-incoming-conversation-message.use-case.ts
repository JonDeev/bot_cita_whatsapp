import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import {
  CONVERSATION_MESSAGE_REPOSITORY,
  CONVERSATION_PERSISTENCE_REPOSITORY,
  CONVERSATION_SESSION_REPOSITORY,
} from '../../domain/conversations.tokens';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationMessageRepository } from '../../domain/ports/conversation-message.repository';
import type { ConversationPersistenceRepository } from '../../domain/ports/conversation-persistence.repository';
import type { ConversationSessionRepository } from '../../domain/ports/conversation-session.repository';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import type { ConversationState } from '../../domain/conversation-state';
import type { ConversationStatus } from '../../domain/conversation-status';
import { ConversationConfigService } from '../services/conversation-config.service';
import { ConversationKeyFactory } from '../services/conversation-key.factory';
import {
  ConversationNavigationService,
  NAVIGATION_OPTION_IDS,
} from '../services/conversation-navigation.service';
import { ConversationStatePromptService } from '../services/conversation-state-prompt.service';
import { ConversationStateHandlerResolverService } from '../services/conversation-state-handler-resolver.service';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import type { ConversationStateHandlerResult } from '../state-handlers/conversation-state-handler';

export interface HandleIncomingConversationMessageResult {
  outboundMessages: ConversationOutboundMessage[];
}

interface ResolvedConversationSession {
  session: ConversationSession;
  wasCreated: boolean;
  wasRestoredFromPersistence: boolean;
}

@Injectable()
export class HandleIncomingConversationMessageUseCase {
  private static readonly MAX_HANDLER_TRANSITIONS_PER_EVENT = 3;

  constructor(
    @Inject(CONVERSATION_SESSION_REPOSITORY)
    private readonly conversationSessionRepository: ConversationSessionRepository,
    @Inject(CONVERSATION_PERSISTENCE_REPOSITORY)
    private readonly conversationPersistenceRepository: ConversationPersistenceRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly conversationStateHandlerResolver: ConversationStateHandlerResolverService,
    private readonly conversationNavigationService: ConversationNavigationService,
    private readonly conversationStatePromptService: ConversationStatePromptService,
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly conversationConfigService: ConversationConfigService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    event: NormalizedWhatsappEvent,
  ): Promise<HandleIncomingConversationMessageResult> {
    if (event.kind !== 'incoming_message_received') {
      return { outboundMessages: [] };
    }

    const conversationKey = this.conversationKeyFactory.createWhatsappConversationKey(
      event.phoneNumberId,
      event.from,
    );
    const resolvedSession = await this.resolveSession(conversationKey, event);
    const session = resolvedSession.session;

    await this.auditService.record('conversation.inbound.message_received', {
      conversationKey,
      messageId: event.messageId,
      state: session.state,
      status: session.status,
    });

    if (resolvedSession.wasRestoredFromPersistence) {
      await this.auditService.record('conversation.session.restored_from_persistence', {
        conversationKey,
        state: session.state,
        status: session.status,
      });
    }

    if (resolvedSession.wasCreated) {
      await this.auditService.record('conversation.session.created', {
        conversationKey,
        state: session.state,
        status: session.status,
      });
    }

    await this.conversationMessageRepository.saveInbound({
      conversationKey,
      messageId: event.messageId,
      messageType: event.messageType,
      from: event.from,
      phoneNumberId: event.phoneNumberId ?? null,
      textBody: event.textBody ?? null,
      interactiveReplyId: event.interactiveReplyId ?? null,
      interactiveReplyTitle: event.interactiveReplyTitle ?? null,
      contextMessageId: event.contextMessageId ?? null,
      providerTimestamp: event.timestamp,
      receivedAt: event.receivedAt ?? new Date().toISOString(),
    });

    const hasValidInteractiveContext = await this.hasValidInteractiveContext(
      conversationKey,
      event,
    );
    if (!hasValidInteractiveContext) {
      await this.auditService.record('conversation.interactive.invalid_context_skipped', {
        conversationKey,
        messageId: event.messageId,
        contextMessageId: event.contextMessageId ?? null,
      });
      return { outboundMessages: [] };
    }

    const sessionToProcess = await this.reopenIfClosed(session, event);

    if (sessionToProcess.status !== CONVERSATION_STATUSES.BOT_ACTIVE) {
      await this.auditService.record('conversation.processing.skipped', {
        conversationKey,
        reason: sessionToProcess.status,
      });
      return { outboundMessages: [] };
    }

    const navigationCommand = await this.handleNavigationCommand(sessionToProcess, event);

    const { finalSession: updatedSession, finalResult: handlerResult } =
      navigationCommand ??
      (await this.handleWithAutoTransitions(sessionToProcess, event));

    const outboundMessagesWithNavigation = this.appendNavigationButtons(
      updatedSession.state,
      updatedSession.status,
      handlerResult.outboundMessages,
    );

    await this.conversationSessionRepository.save(updatedSession);
    await this.conversationPersistenceRepository.upsert(updatedSession);

    if (updatedSession.state !== sessionToProcess.state) {
      await this.auditService.record('conversation.state.changed', {
        conversationKey,
        previousState: sessionToProcess.state,
        nextState: updatedSession.state,
      });
    }

    await this.auditService.record('conversation.outbound.prepared', {
      conversationKey,
      outboundCount: outboundMessagesWithNavigation.length,
      sessionTtlSeconds: this.conversationConfigService.getSessionTtlSeconds(),
    });

    return {
      outboundMessages: outboundMessagesWithNavigation,
    };
  }

  private createInitialSession(
    conversationKey: string,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): ConversationSession {
    const timestamp = new Date().toISOString();

    return {
      conversationKey,
      channel: 'whatsapp',
      participantPhone: event.from,
      phoneNumberId: event.phoneNumberId ?? null,
      state: CONVERSATION_STATES.MAIN_MENU,
      status: CONVERSATION_STATUSES.BOT_ACTIVE,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async resolveSession(
    conversationKey: string,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): Promise<ResolvedConversationSession> {
    const cachedSession = await this.conversationSessionRepository.findByKey(conversationKey);
    if (cachedSession) {
      return {
        session: cachedSession,
        wasCreated: false,
        wasRestoredFromPersistence: false,
      };
    }

    if (this.conversationConfigService.shouldRestoreSessionFromPersistence()) {
      const persistedSession = await this.conversationPersistenceRepository.findByKey(
        conversationKey,
      );
      if (persistedSession) {
        await this.conversationSessionRepository.save(persistedSession);
        return {
          session: persistedSession,
          wasCreated: false,
          wasRestoredFromPersistence: true,
        };
      }
    }

    return {
      session: this.createInitialSession(conversationKey, event),
      wasCreated: true,
      wasRestoredFromPersistence: false,
    };
  }

  private buildUpdatedSession(
    session: ConversationSession,
    nextState: ConversationSession['state'],
    phoneNumberId: string | undefined,
    nextStatus?: ConversationSession['status'],
    nextContext?: ConversationSessionContext,
  ): ConversationSession {
    return {
      ...session,
      state: nextState,
      status: nextStatus ?? session.status,
      context: nextContext ?? session.context,
      phoneNumberId: phoneNumberId ?? session.phoneNumberId,
      updatedAt: new Date().toISOString(),
    };
  }

  private async handleWithAutoTransitions(
    session: ConversationSession,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): Promise<{
    finalSession: ConversationSession;
    finalResult: ConversationStateHandlerResult;
  }> {
    let currentSession = session;
    let currentResult: ConversationStateHandlerResult | null = null;

    for (let index = 0; index < HandleIncomingConversationMessageUseCase.MAX_HANDLER_TRANSITIONS_PER_EVENT; index += 1) {
      const handler = this.conversationStateHandlerResolver.resolve(currentSession.state);
      currentResult = await handler.handle(currentSession, event);

      currentSession = this.buildUpdatedSession(
        currentSession,
        currentResult.nextState,
        event.phoneNumberId,
        currentResult.nextStatus,
        currentResult.nextContext,
      );

      if (currentResult.outboundMessages.length > 0) {
        return { finalSession: currentSession, finalResult: currentResult };
      }
    }

    if (!currentResult) {
      throw new Error('Conversation state handler did not return a result.');
    }

    return { finalSession: currentSession, finalResult: currentResult };
  }

  private async reopenIfClosed(
    session: ConversationSession,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): Promise<ConversationSession> {
    if (session.status !== CONVERSATION_STATUSES.CLOSED) {
      return session;
    }

    await this.auditService.record('conversation.reopened.by_inbound_message', {
      conversationKey: session.conversationKey,
      triggerMessageId: event.messageId,
    });

    return this.buildUpdatedSession(
      session,
      CONVERSATION_STATES.MAIN_MENU,
      event.phoneNumberId,
      CONVERSATION_STATUSES.BOT_ACTIVE,
      undefined,
    );
  }

  private async hasValidInteractiveContext(
    conversationKey: string,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): Promise<boolean> {
    if (event.messageType !== 'interactive' || !event.contextMessageId) {
      return true;
    }

    return this.conversationMessageRepository.hasKnownOutboundMessage(
      conversationKey,
      event.contextMessageId,
    );
  }

  private appendNavigationButtons(
    state: ConversationState,
    status: ConversationStatus,
    outboundMessages: ConversationOutboundMessage[],
  ): ConversationOutboundMessage[] {
    if (status !== CONVERSATION_STATUSES.BOT_ACTIVE || outboundMessages.length === 0) {
      return outboundMessages;
    }

    if (state === CONVERSATION_STATES.MAIN_MENU) {
      return outboundMessages;
    }

    if (outboundMessages.some((message) => message.type === 'interactive_buttons')) {
      return outboundMessages;
    }

    const navigationMessage = this.conversationNavigationService.buildNavigationMessage(state);
    if (!navigationMessage) {
      return outboundMessages;
    }

    return [...outboundMessages, navigationMessage];
  }

  private async handleNavigationCommand(
    session: ConversationSession,
    event: Extract<NormalizedWhatsappEvent, { kind: 'incoming_message_received' }>,
  ): Promise<
    | {
        finalSession: ConversationSession;
        finalResult: ConversationStateHandlerResult;
      }
    | null
  > {
    if (
      event.messageType !== 'interactive' ||
      !this.conversationNavigationService.isNavigationOptionId(event.interactiveReplyId)
    ) {
      return null;
    }

    const optionId = event.interactiveReplyId;
    await this.auditService.record('conversation.navigation.selected', {
      conversationKey: session.conversationKey,
      optionId,
      currentState: session.state,
    });

    if (optionId === NAVIGATION_OPTION_IDS.FINISH) {
      const finalSession = this.buildUpdatedSession(
        session,
        session.state,
        event.phoneNumberId,
        CONVERSATION_STATUSES.CLOSED,
      );

      await this.auditService.record('conversation.closed.by_patient', {
        conversationKey: session.conversationKey,
      });

      return {
        finalSession,
        finalResult: {
          nextState: finalSession.state,
          nextStatus: finalSession.status,
          outboundMessages: [
            {
              type: 'text',
              body: 'Gracias por comunicarte con IPS SISM. Cuando desees, escribe de nuevo y con gusto te ayudamos.',
            },
          ],
        },
      };
    }

    if (optionId === NAVIGATION_OPTION_IDS.MAIN_MENU) {
      const finalSession = this.buildUpdatedSession(
        session,
        CONVERSATION_STATES.MAIN_MENU,
        event.phoneNumberId,
        CONVERSATION_STATUSES.BOT_ACTIVE,
        {
          ...session.context,
          flowIntent: undefined,
          assignedAppointmentSelection: undefined,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
      );

      return {
        finalSession,
        finalResult: {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          outboundMessages: [this.mainMenuListFactory.build()],
        },
      };
    }

    const backNavigation = this.conversationNavigationService.resolveBackNavigation(session);
    const backTargetSession = this.buildUpdatedSession(
      session,
      backNavigation.targetState,
      event.phoneNumberId,
      CONVERSATION_STATUSES.BOT_ACTIVE,
      backNavigation.nextContext,
    );
    const promptResult = this.conversationStatePromptService.buildForState(
      backTargetSession,
      backNavigation.targetState,
    );
    const finalSession = this.buildUpdatedSession(
      backTargetSession,
      promptResult.nextState,
      event.phoneNumberId,
      CONVERSATION_STATUSES.BOT_ACTIVE,
      promptResult.nextContext,
    );

    return {
      finalSession,
      finalResult: {
        nextState: promptResult.nextState,
        outboundMessages: promptResult.outboundMessages,
      },
    };
  }
}
