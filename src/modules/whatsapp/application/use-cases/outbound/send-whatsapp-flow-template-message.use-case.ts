import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { WHATSAPP_MESSAGE_SENDER } from '../../../domain/whatsapp.tokens';
import type { WhatsappMessageSenderPort } from '../../../domain/ports/whatsapp-message-sender.port';
import type { OutboundWhatsappFlowTemplateMessage, OutboundWhatsappSendResult } from '../../../domain/value-objects/outbound-whatsapp-message';

export interface SendWhatsappFlowTemplateMessageInput {
  to: string;
  templateName: string;
  languageCode: string;
  bodyTextParameters?: OutboundWhatsappFlowTemplateMessage['bodyTextParameters'];
  buttonIndex: string;
  flowToken: string;
  flowActionData?: OutboundWhatsappFlowTemplateMessage['flowActionData'];
  trigger: string;
}

@Injectable()
export class SendWhatsappFlowTemplateMessageUseCase {
  constructor(
    @Inject(WHATSAPP_MESSAGE_SENDER)
    private readonly messageSender: WhatsappMessageSenderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: SendWhatsappFlowTemplateMessageInput): Promise<OutboundWhatsappSendResult> {
    this.validateInput(input);

    await this.auditService.record('whatsapp.outbound.flow_template.attempted', {
      to: input.to,
      trigger: input.trigger,
      templateName: input.templateName,
    });

    try {
      const result = await this.messageSender.sendFlowTemplateMessage({
        to: input.to,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyTextParameters: input.bodyTextParameters,
        buttonIndex: input.buttonIndex,
        flowToken: input.flowToken,
        flowActionData: input.flowActionData,
      });

      await this.auditService.record('whatsapp.outbound.flow_template.sent', {
        to: input.to,
        trigger: input.trigger,
        templateName: input.templateName,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record('whatsapp.outbound.flow_template.failed', {
        to: input.to,
        trigger: input.trigger,
        templateName: input.templateName,
        errorMessage,
      });

      throw error;
    }
  }

  private validateInput(input: SendWhatsappFlowTemplateMessageInput): void {
    if (!input.to?.trim()) {
      throw new BadRequestException('Recipient phone number is required.');
    }

    if (!input.templateName?.trim()) {
      throw new BadRequestException('Flow template name is required.');
    }

    if (!input.languageCode?.trim()) {
      throw new BadRequestException('Flow template language code is required.');
    }

    if (!input.buttonIndex?.trim()) {
      throw new BadRequestException('Flow template button index is required.');
    }

    if (!/^\d+$/.test(input.buttonIndex)) {
      throw new BadRequestException('Flow template button index must be numeric.');
    }

    if (!input.flowToken?.trim()) {
      throw new BadRequestException('Flow token is required.');
    }

    if (input.bodyTextParameters) {
      for (const [index, parameter] of input.bodyTextParameters.entries()) {
        if (!parameter?.trim()) {
          throw new BadRequestException(
            `Flow template body parameter at index ${index} is required.`,
          );
        }
      }
    }
  }
}
