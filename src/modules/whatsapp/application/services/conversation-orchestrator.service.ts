import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConversationOutboundMessage } from '../../../conversations/domain/value-objects/conversation-outbound-message';
import { HandleIncomingConversationMessageUseCase } from '../../../conversations/application/use-cases/handle-incoming-conversation-message.use-case';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import { SendWhatsappInteractiveListMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-list-message.use-case';
import { SendWhatsappInteractiveButtonsMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-buttons-message.use-case';
import { SendWhatsappTextMessageUseCase } from '../use-cases/outbound/send-whatsapp-text-message.use-case';
import { WhatsappConfigService } from './whatsapp-config.service';
import type { NormalizedWhatsappEvent } from '../../domain/events/normalized-whatsapp.event';
import { RecordSatisfactionSurveyFlowSubmissionUseCase } from '../../../surveys/application/use-cases/record-satisfaction-survey-flow-submission.use-case';

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
    private readonly whatsappConfig: WhatsappConfigService,
  ) {}

  async handleEvents(events: NormalizedWhatsappEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.log(
        `Received event kind=${event.kind} messageId=${event.messageId} phoneNumberId=${event.phoneNumberId ?? 'n/a'}`,
      );

      if (event.kind !== 'incoming_message_received') {
        continue;
      }

      if (event.messageType !== 'text' && event.messageType !== 'interactive') {
        continue;
      }

      const surveyFlowSubmissionResult =
        await this.recordSatisfactionSurveyFlowSubmission.execute(event);
      if (surveyFlowSubmissionResult.handled) {
        continue;
      }

      if (!this.whatsappConfig.isAutoReplyEnabled()) {
        continue;
      }

      const result = await this.handleIncomingConversationMessage.execute(event);

      for (const outboundMessage of result.outboundMessages) {
        await this.dispatchOutboundMessage(
          {
            conversationKey: `whatsapp:${event.phoneNumberId ?? 'unknown'}:${event.from}`,
            to: event.from,
          },
          outboundMessage,
        );
      }
    }
  }

  private async dispatchOutboundMessage(
    input: {
      conversationKey: string;
      to: string;
    },
    outboundMessage: ConversationOutboundMessage,
  ): Promise<void> {
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
        return;
      }

      if (outboundMessage.type === 'interactive_buttons') {
        const response = await this.sendWhatsappInteractiveButtonsMessage.execute({
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
        return;
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
    } catch (error) {
      this.logger.error(
        `Failed to dispatch outbound WhatsApp message to ${input.to}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
