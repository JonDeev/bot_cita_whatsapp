import { Injectable } from '@nestjs/common';
import { CONVERSATION_STATES, type ConversationState } from '../../domain/conversation-state';
import type {
  ConversationSessionContext,
  InteractivePromptSource,
  InteractivePromptWindowItem,
} from '../../domain/entities/conversation-session-context.entity';
import type {
  ConversationOutboundInteractiveButtonsMessage,
  ConversationOutboundInteractiveListMessage,
  ConversationOutboundMessage,
} from '../../domain/value-objects/conversation-outbound-message';

export const INTERACTIVE_PROMPT_INVALID_REASONS = {
  MISSING_ACTIVE_PROMPT: 'MISSING_ACTIVE_PROMPT',
  REPLY_ID_NOT_ALLOWED: 'REPLY_ID_NOT_ALLOWED',
  CONTEXT_MESSAGE_ID_MISMATCH: 'CONTEXT_MESSAGE_ID_MISMATCH',
  MISSING_CONTEXT_MESSAGE_ID_WITHOUT_SAFE_FALLBACK:
    'MISSING_CONTEXT_MESSAGE_ID_WITHOUT_SAFE_FALLBACK',
  PROMPT_STATE_MISMATCH: 'PROMPT_STATE_MISMATCH',
} as const;

export type InteractivePromptInvalidReason =
  (typeof INTERACTIVE_PROMPT_INVALID_REASONS)[keyof typeof INTERACTIVE_PROMPT_INVALID_REASONS];

export interface ValidateInteractiveReplyInput {
  state: ConversationState;
  interactiveReplyId?: string;
  contextMessageId?: string;
  context?: ConversationSessionContext;
}

export interface ValidateInteractiveReplyResult {
  isValid: boolean;
  reason: InteractivePromptInvalidReason | null;
  matchedPrompt: InteractivePromptWindowItem | null;
}

export interface RegisterInteractivePromptInput {
  state: ConversationState;
  outboundMessageId: string;
  outboundMessage: ConversationOutboundMessage;
  context?: ConversationSessionContext;
  source: InteractivePromptSource;
  issuedAt: string;
}

@Injectable()
export class InteractivePromptWindowService {
  registerPrompt(
    input: RegisterInteractivePromptInput,
  ): ConversationSessionContext | undefined {
    const prompt = this.createPromptItem(input);
    if (!prompt) {
      return this.clear(input.context);
    }

    const existingPrompts =
      input.context?.interactivePromptWindow?.prompts ?? [];
    const nextPrompts =
      input.source === 'IDLE_REMINDER_REISSUE'
        ? this.retainCompatPreviousPrompts(existingPrompts, prompt)
        : existingPrompts.filter((existingPrompt) => existingPrompt.state === input.state);

    nextPrompts.push(prompt);
    const currentPrompt = this.resolveCurrentPrompt(nextPrompts);

    return {
      ...(input.context ?? {}),
      interactivePromptWindow: {
        currentPromptId: currentPrompt.promptId,
        prompts: nextPrompts,
      },
    };
  }

  clear(
    context?: ConversationSessionContext,
  ): ConversationSessionContext | undefined {
    if (!context) {
      return undefined;
    }

    const nextContext = { ...context };
    delete nextContext.interactivePromptWindow;

    return Object.keys(nextContext).length > 0 ? nextContext : undefined;
  }

  validateReply(
    input: ValidateInteractiveReplyInput,
  ): ValidateInteractiveReplyResult {
    const window = input.context?.interactivePromptWindow;
    if (!window || window.prompts.length === 0) {
      return this.invalid(INTERACTIVE_PROMPT_INVALID_REASONS.MISSING_ACTIVE_PROMPT);
    }

    if (!input.interactiveReplyId) {
      return this.invalid(INTERACTIVE_PROMPT_INVALID_REASONS.REPLY_ID_NOT_ALLOWED);
    }

    const compatibleByReply = window.prompts.filter((prompt) =>
      prompt.allowedReplyIds.includes(input.interactiveReplyId as string),
    );
    if (compatibleByReply.length === 0) {
      return this.invalid(INTERACTIVE_PROMPT_INVALID_REASONS.REPLY_ID_NOT_ALLOWED);
    }

    const compatibleByState = compatibleByReply.filter(
      (prompt) => prompt.state === input.state,
    );
    if (compatibleByState.length === 0) {
      return this.invalid(INTERACTIVE_PROMPT_INVALID_REASONS.PROMPT_STATE_MISMATCH);
    }

    if (input.contextMessageId) {
      const matchedByContext = compatibleByState.find(
        (prompt) => prompt.outboundMessageId === input.contextMessageId,
      );

      if (!matchedByContext) {
        return this.invalid(
          INTERACTIVE_PROMPT_INVALID_REASONS.CONTEXT_MESSAGE_ID_MISMATCH,
        );
      }

      return { isValid: true, reason: null, matchedPrompt: matchedByContext };
    }

    if (compatibleByState.length === 1) {
      return { isValid: true, reason: null, matchedPrompt: compatibleByState[0] };
    }

    if (
      compatibleByState.length === 2 &&
      this.areReminderCompatiblePair(compatibleByState[0], compatibleByState[1])
    ) {
      const currentPrompt = compatibleByState.find(
        (prompt) => prompt.promptId === window.currentPromptId,
      );
      return {
        isValid: true,
        reason: null,
        matchedPrompt: currentPrompt ?? compatibleByState[0],
      };
    }

    return this.invalid(
      INTERACTIVE_PROMPT_INVALID_REASONS
        .MISSING_CONTEXT_MESSAGE_ID_WITHOUT_SAFE_FALLBACK,
    );
  }

  private invalid(reason: InteractivePromptInvalidReason) {
    return { isValid: false, reason, matchedPrompt: null };
  }

  private createPromptItem(
    input: RegisterInteractivePromptInput,
  ): InteractivePromptWindowItem | null {
    if (input.outboundMessage.type === 'text') {
      return null;
    }

    const allowedReplyIds = this.resolveAllowedReplyIds(input.outboundMessage);
    if (allowedReplyIds.length === 0) {
      return null;
    }

    const promptKind = this.resolvePromptKind(input.state, input.outboundMessage);
    const logicalStepKey = this.resolveLogicalStepKey(
      input.state,
      promptKind,
      input.context,
    );

    return {
      promptId: this.buildPromptId(input.outboundMessageId),
      logicalStepKey,
      promptKind,
      state: input.state,
      outboundMessageId: input.outboundMessageId,
      allowedReplyIds,
      issuedAt: input.issuedAt,
      source: input.source,
    };
  }

  private resolveAllowedReplyIds(message: ConversationOutboundMessage): string[] {
    if (message.type === 'interactive_list') {
      return message.sections.flatMap((section) =>
        section.rows.map((row) => row.id.trim()).filter(Boolean),
      );
    }

    if (message.type === 'interactive_buttons') {
      return message.buttons.map((button) => button.id.trim()).filter(Boolean);
    }

    return [];
  }

  private resolvePromptKind(
    state: ConversationState,
    message:
      | ConversationOutboundInteractiveListMessage
      | ConversationOutboundInteractiveButtonsMessage,
  ): string {
    if (this.isNavigationMessage(message)) {
      return 'NAVIGATION';
    }

    switch (state) {
      case CONVERSATION_STATES.MAIN_MENU:
        return 'MAIN_MENU';
      case CONVERSATION_STATES.SELECTING_SPECIALTY:
        return 'SPECIALTY_SELECTION';
      case CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT:
        return 'ASSIGNED_APPOINTMENT_SELECTION';
      case CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT:
        return 'CONTACT_CONFIRMATION';
      case CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD:
        return 'CONTACT_UPDATE_FIELD_SELECTION';
      case CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE:
        return 'APPOINTMENT_DATE_SELECTION';
      case CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR:
        return 'APPOINTMENT_DOCTOR_SELECTION';
      case CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME:
        return 'APPOINTMENT_TIME_SELECTION';
      case CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN:
        return 'WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN';
      case CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS:
        return 'ASSIGNED_APPOINTMENT_ACTIONS';
      default:
        return 'STATE_PROMPT';
    }
  }

  private resolveLogicalStepKey(
    state: ConversationState,
    promptKind: string,
    context?: ConversationSessionContext,
  ): string {
    if (promptKind === 'NAVIGATION') {
      return `NAVIGATION:${state}`;
    }

    if (state === CONVERSATION_STATES.MAIN_MENU) {
      return 'MAIN_MENU:ROOT';
    }

    if (state === CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT) {
      const offset = context?.assignedAppointmentSelection?.currentOffset ?? 0;
      return `SELECTING_ASSIGNED_APPOINTMENT:OFFSET_${offset}`;
    }

    if (state === CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE) {
      const scope = context?.appointmentDateSelection?.scope ?? 'SPECIALTY';
      return `SELECTING_APPOINTMENT_DATE:${scope}`;
    }

    return `${state}:ROOT`;
  }

  private retainCompatPreviousPrompts(
    prompts: InteractivePromptWindowItem[],
    currentPrompt: InteractivePromptWindowItem,
  ): InteractivePromptWindowItem[] {
    const compatiblePrompts = prompts
      .filter((prompt) => this.areReminderCompatiblePair(prompt, currentPrompt))
      .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt));

    if (compatiblePrompts.length === 0) {
      return [];
    }

    return [compatiblePrompts[0]];
  }

  private resolveCurrentPrompt(
    prompts: InteractivePromptWindowItem[],
  ): InteractivePromptWindowItem {
    const nonNavigationPrompt = [...prompts]
      .reverse()
      .find((prompt) => prompt.promptKind !== 'NAVIGATION');

    return nonNavigationPrompt ?? prompts[prompts.length - 1];
  }

  private areReminderCompatiblePair(
    first: InteractivePromptWindowItem,
    second: InteractivePromptWindowItem,
  ): boolean {
    return (
      first.logicalStepKey === second.logicalStepKey &&
      first.state === second.state &&
      first.promptKind === second.promptKind &&
      this.sameAllowedReplyIds(first.allowedReplyIds, second.allowedReplyIds)
    );
  }

  private sameAllowedReplyIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();

    return leftSorted.every((value, index) => value === rightSorted[index]);
  }

  private isNavigationMessage(
    message:
      | ConversationOutboundInteractiveListMessage
      | ConversationOutboundInteractiveButtonsMessage,
  ): boolean {
    if (message.type !== 'interactive_buttons') {
      return false;
    }

    return message.buttons.every((button) => button.id.startsWith('nav_'));
  }

  private buildPromptId(outboundMessageId: string): string {
    return `prompt:${outboundMessageId}`;
  }
}
