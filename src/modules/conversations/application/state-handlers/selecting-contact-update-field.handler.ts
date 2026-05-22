import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS } from '../services/patient-contact-update-field-option-id';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingContactUpdateFieldHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD;

  constructor(
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: this.state,
        outboundMessages: [],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.PHONE
    ) {
      await this.auditService.record('patient.contact_update.option_selected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: 'PHONE',
      });

      return {
        nextState: CONVERSATION_STATES.UPDATING_CONTACT_PHONE,
        nextContext: {
          ...session.context,
          contactVerification: session.context?.contactVerification
            ? {
                ...session.context.contactVerification,
                selectedUpdateMode: 'PHONE',
                pendingPhone: undefined,
                invalidPhoneAttempts: 0,
                invalidEmailAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Escribe tu nuevo numero celular en formato 3001234567.',
          },
        ],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.EMAIL
    ) {
      await this.auditService.record('patient.contact_update.option_selected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: 'EMAIL',
      });

      return {
        nextState: CONVERSATION_STATES.UPDATING_CONTACT_EMAIL,
        nextContext: {
          ...session.context,
          contactVerification: session.context?.contactVerification
            ? {
                ...session.context.contactVerification,
                selectedUpdateMode: 'EMAIL',
                pendingPhone: undefined,
                invalidPhoneAttempts: 0,
                invalidEmailAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Escribe tu nuevo correo electronico.',
          },
        ],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BOTH
    ) {
      await this.auditService.record('patient.contact_update.option_selected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: 'BOTH',
      });

      return {
        nextState: CONVERSATION_STATES.UPDATING_CONTACT_PHONE,
        nextContext: {
          ...session.context,
          contactVerification: session.context?.contactVerification
            ? {
                ...session.context.contactVerification,
                selectedUpdateMode: 'BOTH',
                pendingPhone: undefined,
                invalidPhoneAttempts: 0,
                invalidEmailAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Primero escribe tu nuevo numero celular en formato 3001234567.',
          },
        ],
      };
    }

    return {
      nextState: this.state,
      outboundMessages: [this.patientContactUpdateOptionsListFactory.build()],
    };
  }
}
