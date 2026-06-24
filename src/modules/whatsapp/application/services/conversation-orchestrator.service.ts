import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConversationOutboundMessage } from '../../../conversations/domain/value-objects/conversation-outbound-message';
import {
  HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES,
  HandleIncomingConversationMessageUseCase,
} from '../../../conversations/application/use-cases/handle-incoming-conversation-message.use-case';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import { SendWhatsappInteractiveListMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-list-message.use-case';
import { SendWhatsappInteractiveButtonsMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-buttons-message.use-case';
import { SendWhatsappTextMessageUseCase } from '../use-cases/outbound/send-whatsapp-text-message.use-case';
import { WhatsappConfigService } from './whatsapp-config.service';
import type { NormalizedWhatsappEvent } from '../../domain/events/normalized-whatsapp.event';
import { RecordSatisfactionSurveyFlowSubmissionUseCase } from '../../../surveys/application/use-cases/record-satisfaction-survey-flow-submission.use-case';
import { RecordSatisfactionSurveyTemplateReplyUseCase } from '../../../surveys/application/use-cases/record-satisfaction-survey-template-reply.use-case';
import { HandleSatisfactionSurveyPhoneVerificationReplyUseCase } from '../../../surveys/application/use-cases/handle-satisfaction-survey-phone-verification-reply.use-case';
import { HandleAppointmentReminderVerificationReplyUseCase } from '../../../reminders/application/use-cases/handle-appointment-reminder-verification-reply.use-case';
import { WEBHOOK_PROCESSING_STATUSES } from '../../domain/ports/webhook-inbox.repository.port';

export interface ConversationOrchestrationResult {
  processingStatus:
    | typeof WEBHOOK_PROCESSING_STATUSES.PROCESSED
    | typeof WEBHOOK_PROCESSING_STATUSES.SKIPPED_INVALID_CONTEXT;
  rejectionReason?: string;
}

@Injectable()
export class ConversationOrchestratorService {
  private readonly logger = new Logger(ConversationOrchestratorService.name);

  constructor(
    private readonly handleIncomingConversationMessage: HandleIncomingConversationMessageUseCase,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly sendWhatsappInteractiveListMessage: SendWhatsappInteractiveListMessageUseCase,
    private readonly sendWhatsappInteractiveButtonsMessage: SendWhatsappInteractiveButtonsMessageUseCase,
    private readonly sendWhatsappTextMessage: SendWhatsappTextMessageUseCase,
    private readonly recordSatisfactionSurveyFlowSubmission: RecordSatisfactionSurveyFlowSubmissionUseCase,
    private readonly recordSatisfactionSurveyTemplateReply: RecordSatisfactionSurveyTemplateReplyUseCase,
    private readonly handleSatisfactionSurveyPhoneVerificationReply: HandleSatisfactionSurveyPhoneVerificationReplyUseCase,
    private readonly handleAppointmentReminderVerificationReply: HandleAppointmentReminderVerificationReplyUseCase,
    private readonly whatsappConfig: WhatsappConfigService,
  ) {}

  async handleEvents(events: NormalizedWhatsappEvent[]): Promise<void> {
    for (const event of events) {
      await this.handleEvent(event);
    }
  }

  async handleEvent(
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationOrchestrationResult> {
    this.logger.log(
      `Received event kind=${event.kind} messageId=${event.messageId} phoneNumberId=${event.phoneNumberId ?? 'n/a'}`,
    );

    if (event.kind !== 'incoming_message_received') {
      return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
    }

    if (event.messageType !== 'text' && event.messageType !== 'interactive') {
      return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
    }

    const surveyFlowSubmissionResult =
      await this.recordSatisfactionSurveyFlowSubmission.execute(event);
    if (surveyFlowSubmissionResult.handled) {
      return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
    }

    const surveyTemplateReplyResult =
      await this.recordSatisfactionSurveyTemplateReply.execute(event);
    if (surveyTemplateReplyResult.handled) {
      return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
    }

    if (event.messageType === 'interactive' && event.interactiveReplyId) {
      const surveyVerificationReplyResult =
        await this.handleSatisfactionSurveyPhoneVerificationReply.execute(event);
      if (surveyVerificationReplyResult.handled) {
        return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
      }
    }

    if (event.messageType === 'interactive' && event.interactiveReplyId) {
      const reminderReplyResult =
        await this.handleAppointmentReminderVerificationReply.execute({
          inboundMessageId: event.messageId,
          fromPhone: event.from,
          interactiveReplyId: event.interactiveReplyId,
          receivedAtIso: event.receivedAt ?? new Date().toISOString(),
        });
      if (reminderReplyResult.handled) {
        return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
      }
    }

    if (!this.whatsappConfig.isAutoReplyEnabled()) {
      return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
    }

    const result = await this.handleIncomingConversationMessage.execute(event);

    const dispatchedInteractivePrompts: Array<{
      outboundMessage: ConversationOutboundMessage;
      whatsappMessageId: string;
      source: 'ORIGINAL';
      issuedAt: string;
    }> = [];

    for (const outboundMessage of result.outboundMessages) {
      const dispatchResult = await this.dispatchOutboundMessage(
        {
          conversationKey: result.conversationKey,
          to: event.from,
        },
        outboundMessage,
      );

      if (
        dispatchResult &&
        outboundMessage.type !== 'text' &&
        dispatchResult.whatsappMessageId
      ) {
        dispatchedInteractivePrompts.push({
          outboundMessage,
          whatsappMessageId: dispatchResult.whatsappMessageId,
          source: 'ORIGINAL',
          issuedAt: dispatchResult.sentAt,
        });
      }
    }

    if (dispatchedInteractivePrompts.length > 0) {
      await this.handleIncomingConversationMessage.registerDispatchedInteractivePrompts(
        {
          session: result.session,
          dispatchedInteractivePrompts,
        },
      );
    }

    if (
      result.status ===
      HANDLE_INCOMING_CONVERSATION_MESSAGE_STATUSES.REJECTED_INVALID_CONTEXT
    ) {
      return {
        processingStatus: WEBHOOK_PROCESSING_STATUSES.SKIPPED_INVALID_CONTEXT,
        rejectionReason: result.skipReason,
      };
    }

    return { processingStatus: WEBHOOK_PROCESSING_STATUSES.PROCESSED };
  }

  private async dispatchOutboundMessage(
    input: {
      conversationKey: string;
      to: string;
    },
    outboundMessage: ConversationOutboundMessage,
  ): Promise<{ whatsappMessageId: string; sentAt: string } | null> {
    const sentAt = new Date().toISOString();

    try {
      if (outboundMessage.type === 'interactive_list') {
        const response = await this.sendWhatsappInteractiveListMessage.execute({
          to: input.to,
          body: outboundMessage.body,
          buttonText: outboundMessage.buttonText,
          sections: outboundMessage.sections,
          trigger: 'conversation_state_response',
        });
        await this.conversationMessageRepository.saveOutbound({
          conversationKey: input.conversationKey,
          messageType: 'interactive',
          to: input.to,
          whatsappMessageId: response.messageId,
          body: outboundMessage.body,
          sentAt,
        });
        return { whatsappMessageId: response.messageId, sentAt };
      }

      if (outboundMessage.type === 'interactive_buttons') {
        const response =
          await this.sendWhatsappInteractiveButtonsMessage.execute({
            to: input.to,
            body: outboundMessage.body,
            buttons: outboundMessage.buttons,
            trigger: 'conversation_state_response',
          });
        await this.conversationMessageRepository.saveOutbound({
          conversationKey: input.conversationKey,
          messageType: 'interactive',
          to: input.to,
          whatsappMessageId: response.messageId,
          body: outboundMessage.body,
          sentAt,
        });
        return { whatsappMessageId: response.messageId, sentAt };
      }

      const response = await this.sendWhatsappTextMessage.execute({
        to: input.to,
        body: outboundMessage.body,
        trigger: 'conversation_state_response',
      });
      await this.conversationMessageRepository.saveOutbound({
        conversationKey: input.conversationKey,
        messageType: 'text',
        to: input.to,
        whatsappMessageId: response.messageId,
        body: outboundMessage.body,
        sentAt,
      });
      return { whatsappMessageId: response.messageId, sentAt };
    } catch (error) {
      this.logger.error(
        `Failed to dispatch outbound WhatsApp message to ${input.to}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }
}
