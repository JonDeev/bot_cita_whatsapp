import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { WHATSAPP_MESSAGE_SENDER } from '../../../domain/whatsapp.tokens';
import type { WhatsappMessageSenderPort } from '../../../domain/ports/whatsapp-message-sender.port';
import type {
  OutboundWhatsappInteractiveListMessage,
  OutboundWhatsappSendResult,
} from '../../../domain/value-objects/outbound-whatsapp-message';

export interface SendWhatsappInteractiveListMessageInput {
  to: string;
  body: string;
  buttonText: string;
  sections: OutboundWhatsappInteractiveListMessage['sections'];
  trigger: string;
}

const WHATSAPP_INTERACTIVE_LIST_LIMITS = {
  BODY_MAX_LENGTH: 1024,
  BUTTON_MAX_LENGTH: 20,
  MAX_SECTIONS: 10,
  SECTION_TITLE_MAX_LENGTH: 24,
  MAX_TOTAL_ROWS: 10,
  ROW_ID_MAX_LENGTH: 200,
  ROW_TITLE_MAX_LENGTH: 24,
  ROW_DESCRIPTION_MAX_LENGTH: 72,
} as const;

@Injectable()
export class SendWhatsappInteractiveListMessageUseCase {
  constructor(
    @Inject(WHATSAPP_MESSAGE_SENDER)
    private readonly messageSender: WhatsappMessageSenderPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendWhatsappInteractiveListMessageInput,
  ): Promise<OutboundWhatsappSendResult> {
    if (!input.to?.trim()) {
      throw new BadRequestException('Recipient phone number is required.');
    }

    if (!input.body?.trim()) {
      throw new BadRequestException('Interactive list body is required.');
    }

    if (!input.buttonText?.trim()) {
      throw new BadRequestException(
        'Interactive list button text is required.',
      );
    }

    if (input.sections.length === 0) {
      throw new BadRequestException(
        'Interactive list requires at least one section.',
      );
    }
    this.validateInteractiveList(input);

    await this.auditService.record(
      'whatsapp.outbound.interactive_list.attempted',
      {
        to: input.to,
        trigger: input.trigger,
      },
    );

    try {
      const result = await this.messageSender.sendInteractiveListMessage({
        to: input.to,
        body: input.body,
        buttonText: input.buttonText,
        sections: input.sections,
      });

      await this.auditService.record(
        'whatsapp.outbound.interactive_list.sent',
        {
          to: input.to,
          trigger: input.trigger,
          messageId: result.messageId,
        },
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record(
        'whatsapp.outbound.interactive_list.failed',
        {
          to: input.to,
          trigger: input.trigger,
          errorMessage,
        },
      );

      throw error;
    }
  }

  private validateInteractiveList(
    input: SendWhatsappInteractiveListMessageInput,
  ): void {
    if (
      this.countCharacters(input.body) >
      WHATSAPP_INTERACTIVE_LIST_LIMITS.BODY_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Interactive list body exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.BODY_MAX_LENGTH} characters.`,
      );
    }

    if (
      this.countCharacters(input.buttonText) >
      WHATSAPP_INTERACTIVE_LIST_LIMITS.BUTTON_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Interactive list button text exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.BUTTON_MAX_LENGTH} characters.`,
      );
    }

    if (input.sections.length > WHATSAPP_INTERACTIVE_LIST_LIMITS.MAX_SECTIONS) {
      throw new BadRequestException(
        `Interactive list supports up to ${WHATSAPP_INTERACTIVE_LIST_LIMITS.MAX_SECTIONS} sections.`,
      );
    }

    let totalRows = 0;
    for (const [sectionIndex, section] of input.sections.entries()) {
      if (!section.title?.trim()) {
        throw new BadRequestException(
          `Interactive list section at index ${sectionIndex} requires a title.`,
        );
      }

      if (
        this.countCharacters(section.title) >
        WHATSAPP_INTERACTIVE_LIST_LIMITS.SECTION_TITLE_MAX_LENGTH
      ) {
        throw new BadRequestException(
          `Interactive list section title at index ${sectionIndex} exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.SECTION_TITLE_MAX_LENGTH} characters.`,
        );
      }

      if (section.rows.length === 0) {
        throw new BadRequestException(
          `Interactive list section at index ${sectionIndex} requires at least one row.`,
        );
      }

      totalRows += section.rows.length;
      for (const [rowIndex, row] of section.rows.entries()) {
        if (!row.id?.trim()) {
          throw new BadRequestException(
            `Interactive list row at section ${sectionIndex} index ${rowIndex} requires an id.`,
          );
        }

        if (
          this.countCharacters(row.id) >
          WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_ID_MAX_LENGTH
        ) {
          throw new BadRequestException(
            `Interactive list row id at section ${sectionIndex} index ${rowIndex} exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_ID_MAX_LENGTH} characters.`,
          );
        }

        if (!row.title?.trim()) {
          throw new BadRequestException(
            `Interactive list row at section ${sectionIndex} index ${rowIndex} requires a title.`,
          );
        }

        if (
          this.countCharacters(row.title) >
          WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_TITLE_MAX_LENGTH
        ) {
          throw new BadRequestException(
            `Interactive list row title at section ${sectionIndex} index ${rowIndex} exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_TITLE_MAX_LENGTH} characters.`,
          );
        }

        if (
          row.description &&
          this.countCharacters(row.description) >
            WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_DESCRIPTION_MAX_LENGTH
        ) {
          throw new BadRequestException(
            `Interactive list row description at section ${sectionIndex} index ${rowIndex} exceeds ${WHATSAPP_INTERACTIVE_LIST_LIMITS.ROW_DESCRIPTION_MAX_LENGTH} characters.`,
          );
        }
      }
    }

    if (totalRows > WHATSAPP_INTERACTIVE_LIST_LIMITS.MAX_TOTAL_ROWS) {
      throw new BadRequestException(
        `Interactive list supports up to ${WHATSAPP_INTERACTIVE_LIST_LIMITS.MAX_TOTAL_ROWS} rows in total.`,
      );
    }
  }

  private countCharacters(text: string): number {
    return Array.from(text).length;
  }
}
