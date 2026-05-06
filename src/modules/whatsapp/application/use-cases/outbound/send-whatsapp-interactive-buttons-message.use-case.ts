import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { WHATSAPP_MESSAGE_SENDER } from '../../../domain/whatsapp.tokens';
import type { WhatsappMessageSenderPort } from '../../../domain/ports/whatsapp-message-sender.port';
import type {
  OutboundWhatsappInteractiveButtonsMessage,
  OutboundWhatsappSendResult,
} from '../../../domain/value-objects/outbound-whatsapp-message';

export interface SendWhatsappInteractiveButtonsMessageInput {
  to: string;
  body: string;
  buttons: OutboundWhatsappInteractiveButtonsMessage['buttons'];
  trigger: string;
}

const WHATSAPP_INTERACTIVE_BUTTON_LIMITS = {
  BODY_MAX_LENGTH: 1024,
  MAX_BUTTONS: 3,
  BUTTON_ID_MAX_LENGTH: 256,
  BUTTON_TITLE_MAX_LENGTH: 20,
} as const;

@Injectable()
export class SendWhatsappInteractiveButtonsMessageUseCase {
  constructor(
    @Inject(WHATSAPP_MESSAGE_SENDER)
    private readonly messageSender: WhatsappMessageSenderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendWhatsappInteractiveButtonsMessageInput,
  ): Promise<OutboundWhatsappSendResult> {
    if (!input.to?.trim()) {
      throw new BadRequestException('Recipient phone number is required.');
    }

    if (!input.body?.trim()) {
      throw new BadRequestException('Interactive buttons body is required.');
    }

    if (Array.from(input.body).length > WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BODY_MAX_LENGTH) {
      throw new BadRequestException(
        `Interactive buttons body exceeds ${WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BODY_MAX_LENGTH} characters.`,
      );
    }

    this.validateButtons(input.buttons);

    await this.auditService.record('whatsapp.outbound.interactive_buttons.attempted', {
      to: input.to,
      trigger: input.trigger,
      buttonCount: input.buttons.length,
    });

    try {
      const result = await this.messageSender.sendInteractiveButtonsMessage({
        to: input.to,
        body: input.body,
        buttons: input.buttons,
      });

      await this.auditService.record('whatsapp.outbound.interactive_buttons.sent', {
        to: input.to,
        trigger: input.trigger,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record('whatsapp.outbound.interactive_buttons.failed', {
        to: input.to,
        trigger: input.trigger,
        errorMessage,
      });

      throw error;
    }
  }

  private validateButtons(buttons: OutboundWhatsappInteractiveButtonsMessage['buttons']): void {
    if (buttons.length === 0) {
      throw new BadRequestException('Interactive buttons require at least one button.');
    }

    if (buttons.length > WHATSAPP_INTERACTIVE_BUTTON_LIMITS.MAX_BUTTONS) {
      throw new BadRequestException(
        `Interactive buttons support up to ${WHATSAPP_INTERACTIVE_BUTTON_LIMITS.MAX_BUTTONS} buttons.`,
      );
    }

    const ids = new Set<string>();
    for (const [index, button] of buttons.entries()) {
      if (!button.id?.trim()) {
        throw new BadRequestException(`Button at index ${index} requires an id.`);
      }

      if (ids.has(button.id)) {
        throw new BadRequestException(`Button id '${button.id}' is duplicated.`);
      }
      ids.add(button.id);

      if (Array.from(button.id).length > WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BUTTON_ID_MAX_LENGTH) {
        throw new BadRequestException(
          `Button id at index ${index} exceeds ${WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BUTTON_ID_MAX_LENGTH} characters.`,
        );
      }

      if (!button.title?.trim()) {
        throw new BadRequestException(`Button at index ${index} requires a title.`);
      }

      if (
        Array.from(button.title).length >
        WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BUTTON_TITLE_MAX_LENGTH
      ) {
        throw new BadRequestException(
          `Button title at index ${index} exceeds ${WHATSAPP_INTERACTIVE_BUTTON_LIMITS.BUTTON_TITLE_MAX_LENGTH} characters.`,
        );
      }
    }

  }
}
