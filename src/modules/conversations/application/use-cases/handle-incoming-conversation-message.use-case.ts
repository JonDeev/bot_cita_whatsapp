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
import type { InteractivePromptSource } from '../../domain/entities/conversation-session-context.entity';
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
import {
  INTERACTIVE_PROMPT_INVALID_REASONS,
  type InteractivePromptInvalidReason,
  InteractivePromptWindowService,
} from '../services/interactive-prompt-window.service';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import type { ConversationStateHandlerResult } from '../state-handlers/conversation-state-handler';

export const HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES = {
  HANDLED: 'HANDLED',
  RECOVERED_INVALID_CONTEXT: 'RECOVERED_INVALID_CONTEXT',
  REJECTED_INVALID_CONTEXT: 'REJECTED_INVALID_CONTEXT',
  SKIPPED_CONVERSATION_STATUS: 'SKIPPED_CONVERSATION_STATUS',
} as const;

export type HandleIncomingConversationMessageStatus =
  (typeof HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES)[keyof typeof HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES];

export interface HandleIncomingConversationMessageResult {
  status: HandleIncomingConversationMessageStatus;
  conversationKey: string;
  outboundMessages: ConversationOutboundMessage[];
  session: ConversationSession;
  skipReason?: string;
}

export interface RegisterDispatchedInteractivePromptsInput {
  session: ConversationSession;
  dispatchedInteractivePrompts: Array<{
    outboundMessage: ConversationOutboundMessage;
    whatsappMessageId: string;
    source: InteractivePromptSource;
    issuedAt: string;
  }>;
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
    private readonly interactivePromptWindowService: InteractivePromptWindowService,
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly conversationConfigService: ConversationConfigService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    event: NormalizedWhatsappEvent,
  ): Promise<HandleIncomingConversationMessageResult> {
    if (event.kind !== 'incoming_message_received') {
      throw new Error(
        'HandleIncomingConversationMessageUseCase only supports inbound conversation messages.',
      );
    }

    const conversationKey =
      this.conversationKeyFactory.createWhatsappConversationKey(
        event.phoneNumberId,
        event.from,
      );
    const resolvedSession = await this.resolveSession(conversationKey, event);
    const sessionWithInactivity = this.refreshInactivityByInboundWhenApplicable(
      resolvedSession.session,
      event.receivedAt ?? new Date().toISOString(),
    );

    await this.auditService.record('conversation.inbound.message_received', {
      conversationKey,
      messageId: event.messageId,
      state: sessionWithInactivity.state,
      status: sessionWithInactivity.status,
    });

    if (resolvedSession.wasRestoredFromPersistence) {
      await this.auditService.record(
        'conversation.session.restored_from_persistence',
        {
          conversationKey,
          state: sessionWithInactivity.state,
          status: sessionWithInactivity.status,
        },
      );
    }

    if (resolvedSession.wasCreated) {
      await this.auditService.record('conversation.session.created', {
        conversationKey,
        state: sessionWithInactivity.state,
        status: sessionWithInactivity.status,
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

    const reopenedSession = await this.reopenIfNeeded(
      sessionWithInactivity,
      event,
    );
    const sessionToProcess = this.refreshInactivityByInboundWhenApplicable(
      reopenedSession,
      event.receivedAt ?? new Date().toISOString(),
    );

    if (sessionToProcess.status === CONVERSATION_STATUSES.EXPIRED) {
      const reopenResult = this.buildUpdatedSession(
        sessionToProcess,
        CONVERSATION_STATES.MAIN_MENU,
        event.phoneNumberId,
        CONVERSATION_STATUSES.BOT_ACTIVE,
        this.interactivePromptWindowService.clear({
          ...sessionToProcess.context,
          flowIntent: undefined,
          contactVerification: undefined,
          appointmentNotificationsConsentPhone: undefined,
          assignedAppointmentSelection: undefined,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        }),
      );
      const normalizedReopenSession = this.refreshInactivityByInboundWhenApplicable(
        reopenResult,
        event.receivedAt ?? new Date().toISOString(),
      );
      await this.auditService.record('conversation.reopened.after_expiration', {
        conversationKey,
        triggerMessageId: event.messageId,
      });
      const outboundMessages: ConversationOutboundMessage[] = [
        {
          type: 'text',
          body: 'Tu sesion anterior finalizo por inactividad. Te comparto nuevamente el menu principal para continuar.',
        },
        this.mainMenuListFactory.build(),
      ];

      await this.persistSession(normalizedReopenSession);
      return {
        status: HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.HANDLED,
        conversationKey,
        outboundMessages,
        session: normalizedReopenSession,
      };
    }

    if (sessionToProcess.status !== CONVERSATION_STATUSES.BOT_ACTIVE) {
      await this.auditService.record('conversation.processing.skipped', {
        conversationKey,
        reason: sessionToProcess.status,
      });
      await this.persistSession(sessionToProcess);
      return {
        status:
          HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.SKIPPED_CONVERSATION_STATUS,
        conversationKey,
        outboundMessages: [],
        session: sessionToProcess,
        skipReason: sessionToProcess.status,
      };
    }

    const interactiveContextValidation = this.validateInteractiveContext(
      sessionToProcess,
      event,
    );
    if (!interactiveContextValidation.isValid) {
      const recoveryResult = await this.buildInvalidContextRecoveryResult(
        sessionToProcess,
        event,
        interactiveContextValidation.reason,
      );
      await this.persistSession(recoveryResult.session);
      return recoveryResult;
    }

    if (event.messageType === 'interactive' && !event.interactiveFlowToken) {
      await this.auditService.record('conversation.interactive.reply_accepted', {
        conversationKey,
        messageId: event.messageId,
        interactiveReplyId: event.interactiveReplyId ?? null,
        contextMessageId: event.contextMessageId ?? null,
        state: sessionToProcess.state,
      });
    }

    const navigationCommand = await this.handleNavigationCommand(
      sessionToProcess,
      event,
    );

    const { finalSession: updatedSession, finalResult: handlerResult } =
      navigationCommand ??
      (await this.handleWithAutoTransitions(sessionToProcess, event));

    const outboundMessagesWithNavigation = this.appendNavigationButtons(
      updatedSession.state,
      updatedSession.status,
      handlerResult.outboundMessages,
    );

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

    const preparedSession = {
      ...updatedSession,
      context: this.prepareContextForDispatch(
        updatedSession.context,
        outboundMessagesWithNavigation,
      ),
      updatedAt: new Date().toISOString(),
    };
    await this.persistSession(preparedSession);

    return {
      status: HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.HANDLED,
      conversationKey,
      outboundMessages: outboundMessagesWithNavigation,
      session: preparedSession,
    };
  }

  private createInitialSession(
    conversationKey: string,
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
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
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): Promise<ResolvedConversationSession> {
    const cachedSession =
      await this.conversationSessionRepository.findByKey(conversationKey);
    if (cachedSession) {
      return {
        session: cachedSession,
        wasCreated: false,
        wasRestoredFromPersistence: false,
      };
    }

    if (this.conversationConfigService.shouldRestoreSessionFromPersistence()) {
      const persistedSession =
        await this.conversationPersistenceRepository.findByKey(conversationKey);
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
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): Promise<{
    finalSession: ConversationSession;
    finalResult: ConversationStateHandlerResult;
  }> {
    let currentSession = session;
    let currentResult: ConversationStateHandlerResult | null = null;

    for (
      let index = 0;
      index <
      HandleIncomingConversationMessageUseCase.MAX_HANDLER_TRANSITIONS_PER_EVENT;
      index += 1
    ) {
      const handler = this.conversationStateHandlerResolver.resolve(
        currentSession.state,
      );
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

  private async reopenIfNeeded(
    session: ConversationSession,
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): Promise<ConversationSession> {
    if (
      session.status !== CONVERSATION_STATUSES.CLOSED &&
      session.status !== CONVERSATION_STATUSES.EXPIRED
    ) {
      return session;
    }

    if (session.status === CONVERSATION_STATUSES.CLOSED) {
      await this.auditService.record('conversation.reopened.by_inbound_message', {
        conversationKey: session.conversationKey,
        triggerMessageId: event.messageId,
      });
    }

    return this.buildUpdatedSession(
      session,
      session.status === CONVERSATION_STATUSES.CLOSED
        ? CONVERSATION_STATES.MAIN_MENU
        : session.state,
      event.phoneNumberId,
      session.status === CONVERSATION_STATUSES.CLOSED
        ? CONVERSATION_STATUSES.BOT_ACTIVE
        : session.status,
      undefined,
    );
  }

  private validateInteractiveContext(
    session: ConversationSession,
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): { isValid: boolean; reason: InteractivePromptInvalidReason | null } {
    if (event.messageType !== 'interactive' || event.interactiveFlowToken) {
      return { isValid: true, reason: null };
    }

    return this.interactivePromptWindowService.validateReply({
      state: session.state,
      interactiveReplyId: event.interactiveReplyId,
      contextMessageId: event.contextMessageId,
      context: session.context,
    });
  }

  private async buildInvalidContextRecoveryResult(
    session: ConversationSession,
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
    reason: InteractivePromptInvalidReason | null,
  ): Promise<HandleIncomingConversationMessageResult> {
    const resolvedReason =
      reason ?? INTERACTIVE_PROMPT_INVALID_REASONS.MISSING_ACTIVE_PROMPT;

    if (!event.interactiveReplyId) {
      await this.auditService.record(
        'conversation.interactive.invalid_context_rejected',
        {
          conversationKey: session.conversationKey,
          messageId: event.messageId,
          contextMessageId: event.contextMessageId ?? null,
          reason: resolvedReason,
          recoveryAction: 'NONE',
        },
      );

      return {
        status:
          HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.REJECTED_INVALID_CONTEXT,
        conversationKey: session.conversationKey,
        outboundMessages: [],
        session,
        skipReason: resolvedReason,
      };
    }
    let recoveredOutboundMessages: ConversationOutboundMessage[];
    try {
      const promptResult = this.conversationStatePromptService.buildForState(
        session,
        session.state,
      );
      recoveredOutboundMessages = [
        {
          type: 'text',
          body: 'Esa opcion ya no esta activa. Te envio el paso actualizado.',
        },
        ...this.appendNavigationButtons(
          promptResult.nextState,
          session.status,
          promptResult.outboundMessages,
        ),
      ];
    } catch (error) {
      await this.auditService.record(
        'conversation.interactive.recovery_prompt_reissued',
        {
          conversationKey: session.conversationKey,
          reason: 'PROMPT_REBUILD_FAILED_FALLBACK_MAIN_MENU',
          error:
            error instanceof Error
              ? error.message
              : 'Unknown prompt rebuild error',
        },
      );
      recoveredOutboundMessages = [
        {
          type: 'text',
          body: 'No pudimos continuar con esa opcion. Te envio el menu principal para seguir.',
        },
        this.mainMenuListFactory.build(),
      ];
    }
    const recoverySession: ConversationSession = {
      ...session,
      context: this.prepareContextForDispatch(
        session.context,
        recoveredOutboundMessages,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.auditService.record(
      'conversation.interactive.invalid_context_recovered',
      {
        conversationKey: session.conversationKey,
        messageId: event.messageId,
        interactiveReplyId: event.interactiveReplyId ?? null,
        contextMessageId: event.contextMessageId ?? null,
        reason: resolvedReason,
        recoveryAction: 'REISSUE_CURRENT_STATE_PROMPT',
        state: session.state,
      },
    );

    return {
      status:
        HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.RECOVERED_INVALID_CONTEXT,
      conversationKey: session.conversationKey,
      outboundMessages: recoveredOutboundMessages,
      session: recoverySession,
      skipReason: resolvedReason,
    };
  }

  private prepareContextForDispatch(
    context: ConversationSessionContext | undefined,
    outboundMessages: ConversationOutboundMessage[],
  ): ConversationSessionContext | undefined {
    if (outboundMessages.length === 0) {
      return context;
    }

    const hasInteractivePrompt = outboundMessages.some(
      (message) => message.type !== 'text',
    );
    if (hasInteractivePrompt) {
      // Avoid leaving stale prompt instances while outbound dispatch happens.
      return this.interactivePromptWindowService.clear(context);
    }

    return this.interactivePromptWindowService.clear(context);
  }

  async registerDispatchedInteractivePrompts(
    input: RegisterDispatchedInteractivePromptsInput,
  ): Promise<ConversationSession> {
    let nextContext = input.session.context;

    for (const prompt of input.dispatchedInteractivePrompts) {
      nextContext = this.interactivePromptWindowService.registerPrompt({
        state: input.session.state,
        outboundMessageId: prompt.whatsappMessageId,
        outboundMessage: prompt.outboundMessage,
        context: nextContext,
        source: prompt.source,
        issuedAt: prompt.issuedAt,
      });
    }

    const updatedSession: ConversationSession = {
      ...input.session,
      context: nextContext,
      updatedAt: new Date().toISOString(),
    };
    await this.persistSession(updatedSession);

    return updatedSession;
  }

  private refreshInactivityByInbound(
    session: ConversationSession,
    inboundAt: string,
  ): ConversationSession {
    const idleExpiresAt = new Date(
      Date.parse(inboundAt) + 20 * 60 * 1000,
    ).toISOString();

    return {
      ...session,
      lastInboundAt: inboundAt,
      idleReminderSentAt: undefined,
      idleExpiresAt,
    };
  }

  private refreshInactivityByInboundWhenApplicable(
    session: ConversationSession,
    inboundAt: string,
  ): ConversationSession {
    if (session.status !== CONVERSATION_STATUSES.BOT_ACTIVE) {
      return session;
    }

    return this.refreshInactivityByInbound(session, inboundAt);
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    await this.conversationSessionRepository.save(session);
    await this.conversationPersistenceRepository.upsert(session);
  }

  private appendNavigationButtons(
    state: ConversationState,
    status: ConversationStatus,
    outboundMessages: ConversationOutboundMessage[],
  ): ConversationOutboundMessage[] {
    if (
      status !== CONVERSATION_STATUSES.BOT_ACTIVE ||
      outboundMessages.length === 0
    ) {
      return outboundMessages;
    }

    if (state === CONVERSATION_STATES.MAIN_MENU) {
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

  private async handleNavigationCommand(
    session: ConversationSession,
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): Promise<{
    finalSession: ConversationSession;
    finalResult: ConversationStateHandlerResult;
  } | null> {
    if (
      event.messageType !== 'interactive' ||
      !this.conversationNavigationService.isNavigationOptionId(
        event.interactiveReplyId,
      )
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
          contactVerification: undefined,
          appointmentNotificationsConsentPhone: undefined,
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

    const backNavigation =
      this.conversationNavigationService.resolveBackNavigation(session);
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
