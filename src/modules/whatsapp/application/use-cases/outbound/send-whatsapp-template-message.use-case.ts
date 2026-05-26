import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { WHATSAPP_MESSAGE_SENDER } from '../../../domain/whatsapp.tokens';
import type { WhatsappMessageSenderPort } from '../../../domain/ports/whatsapp-message-sender.port';
import type {
  OutboundWhatsappSendResult,
  OutboundWhatsappTemplateQuickReplyButton,
} from '../../../domain/value-objects/outbound-whatsapp-message';

export interface SendWhatsappTemplateMessageInput {
  to: string;
  templateName: string;
  languageCode: string;
  bodyTextParameters?: string[];
  quickReplyButtons?: OutboundWhatsappTemplateQuickReplyButton[];
  trigger: string;
}

@Injectable()
export class SendWhatsappTemplateMessageUseCase {
  constructor(
    @Inject(WHATSAPP_MESSAGE_SENDER)
    private readonly messageSender: WhatsappMessageSenderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendWhatsappTemplateMessageInput,
  ): Promise<OutboundWhatsappSendResult> {
    this.validateInput(input);

    await this.auditService.record('whatsapp.outbound.template.attempted', {
      to: this.maskPhone(input.to),
      trigger: input.trigger,
      templateName: input.templateName,
    });

    try {
      const result = await this.messageSender.sendTemplateMessage({
        to: input.to,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyTextParameters: input.bodyTextParameters,
        quickReplyButtons: input.quickReplyButtons,
      });

      await this.auditService.record('whatsapp.outbound.template.sent', {
        to: this.maskPhone(input.to),
        trigger: input.trigger,
        templateName: input.templateName,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record('whatsapp.outbound.template.failed', {
        to: this.maskPhone(input.to),
        trigger: input.trigger,
        templateName: input.templateName,
        errorMessage,
      });
      throw error;
    }
  }

  private validateInput(input: SendWhatsappTemplateMessageInput): void {
    if (!input.to?.trim()) {
      throw new BadRequestException('Recipient phone number is required.');
    }

    if (!input.templateName?.trim()) {
      throw new BadRequestException('Template name is required.');
    }

    if (!input.languageCode?.trim()) {
      throw new BadRequestException('Template language code is required.');
    }

    if (input.bodyTextParameters) {
      for (const [index, parameter] of input.bodyTextParameters.entries()) {
        if (!parameter?.trim()) {
          throw new BadRequestException(
            `Template body parameter at index ${index} is required.`,
          );
        }
      }
    }

    if (input.quickReplyButtons) {
      for (const button of input.quickReplyButtons) {
        if (!button.index.trim() || !/^\d+$/.test(button.index)) {
          throw new BadRequestException(
            'Template quick reply button index must be numeric.',
          );
        }

        if (!button.payload.trim()) {
          throw new BadRequestException(
            'Template quick reply button payload is required.',
          );
        }
      }
    }
  }

  private maskPhone(phone: string): string {
    const digitsOnly = phone.replace(/\D+/g, '');
    if (!digitsOnly) {
      return '***';
    }

    if (digitsOnly.length <= 4) {
      return `${'*'.repeat(Math.max(digitsOnly.length - 1, 0))}${digitsOnly.slice(-1)}`;
    }

    return `******${digitsOnly.slice(-4)}`;
  }
}
