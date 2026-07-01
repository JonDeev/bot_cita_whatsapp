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
      return this.buildPhoneUpdateSelectionResult(session, 'PHONE');
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BOTH
    ) {
      return this.buildPhoneUpdateSelectionResult(session, 'BOTH');
    }

    return {
      nextState: this.state,
      outboundMessages: [this.patientContactUpdateOptionsListFactory.build()],
    };
  }

  private async buildPhoneUpdateSelectionResult(
    session: ConversationSession,
    updateMode: 'PHONE' | 'BOTH',
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('patient.contact_update.option_selected', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      updateMode,
    });

    return {
      nextState: CONVERSATION_STATES.UPDATING_CONTACT_PHONE,
      nextContext: {
        ...session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: session.context?.contactVerification
          ? {
              ...session.context.contactVerification,
              selectedUpdateMode: updateMode,
              pendingPhone: undefined,
              verifiedPhone: undefined,
              invalidPhoneAttempts: 0,
              invalidEmailAttempts: 0,
            }
          : undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body:
            updateMode === 'BOTH'
              ? 'Primero escribe tu nuevo numero celular en formato 3001234567.'
              : 'Escribe tu nuevo numero celular en formato 3001234567.',
        },
      ],
    };
  }
}
