import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { WHATSAPP_MESSAGE_SENDER } from '../../../domain/whatsapp.tokens';
import type { WhatsappMessageSenderPort } from '../../../domain/ports/whatsapp-message-sender.port';
import type { OutboundWhatsappSendResult } from '../../../domain/value-objects/outbound-whatsapp-message';

export interface SendWhatsappTextMessageInput {
  to: string;
  body: string;
  trigger: string;
}

@Injectable()
export class SendWhatsappTextMessageUseCase {
  constructor(
    @Inject(WHATSAPP_MESSAGE_SENDER)
    private readonly messageSender: WhatsappMessageSenderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendWhatsappTextMessageInput,
  ): Promise<OutboundWhatsappSendResult> {
    if (!input.to?.trim()) {
      throw new BadRequestException('Recipient phone number is required.');
    }

    if (!input.body?.trim()) {
      throw new BadRequestException('Message body is required.');
    }

    await this.auditService.record('whatsapp.outbound.text.attempted', {
      to: input.to,
      trigger: input.trigger,
    });

    try {
      const result = await this.messageSender.sendTextMessage({
        to: input.to,
        body: input.body,
      });

      await this.auditService.record('whatsapp.outbound.text.sent', {
        to: input.to,
        trigger: input.trigger,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record('whatsapp.outbound.text.failed', {
        to: input.to,
        trigger: input.trigger,
        errorMessage,
      });

      throw error;
    }
  }
}
