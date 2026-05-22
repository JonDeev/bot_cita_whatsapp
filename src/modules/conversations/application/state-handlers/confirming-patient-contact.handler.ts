import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { PATIENT_CONTACT_CONFIRMATION_OPTION_IDS } from '../services/patient-contact-confirmation-option-id';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class ConfirmingPatientContactHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT;

  constructor(
    private readonly patientContactConfirmationMessageFactory: PatientContactConfirmationMessageFactory,
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
    private readonly patientContactUpdateSuccessMessageFactory: PatientContactUpdateSuccessMessageFactory,
    private readonly mainMenuListFactory: MainMenuListFactory,
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

    const contactVerification = session.context?.contactVerification;
    if (!contactVerification) {
      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        outboundMessages: [
          {
            type: 'text',
            body: 'Necesitamos validar tu identidad nuevamente para continuar.',
          },
        ],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId ===
        PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.UPDATE_AND_CONTINUE
    ) {
      await this.auditService.record('patient.contact_confirmation.selected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        selectedOption: 'UPDATE_AND_CONTINUE',
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        outboundMessages: [this.patientContactUpdateOptionsListFactory.build()],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId ===
        PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.CONTINUE
    ) {
      await this.auditService.record('patient.contact_confirmation.selected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        selectedOption: 'CONTINUE',
      });

      if (
        contactVerification.requiresPhoneUpdate ||
        contactVerification.requiresEmailUpdate
      ) {
        await this.auditService.record(
          'patient.contact_update.validation_failed',
          {
            conversationKey: session.conversationKey,
            patientId: session.context?.patientValidation?.patientId ?? null,
            flowIntent: session.context?.flowIntent ?? null,
            reason: 'REQUIRES_CONTACT_UPDATE',
          },
        );

        return {
          nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
          outboundMessages: [
            {
              type: 'text',
              body: 'Para continuar debes actualizar un telefono celular y un correo electronico validos.',
            },
            this.patientContactUpdateOptionsListFactory.build(),
          ],
        };
      }

      if (session.context?.flowIntent === 'UPDATE_CONTACT') {
        await this.auditService.record(
          'patient.contact_update.completed_as_primary_flow',
          {
            conversationKey: session.conversationKey,
            patientId: session.context?.patientValidation?.patientId ?? null,
            flowIntent: session.context?.flowIntent ?? null,
            result: 'CONFIRMED_WITHOUT_CHANGES',
          },
        );

        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            flowIntent: undefined,
            contactVerification: undefined,
            assignedAppointmentSelection: undefined,
            appointmentReschedule: undefined,
            specialtySelection: undefined,
            appointmentDoctorSelection: undefined,
            appointmentDateSelection: undefined,
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            this.patientContactUpdateSuccessMessageFactory.build(),
            this.mainMenuListFactory.build(),
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
        nextContext: {
          ...session.context,
          contactVerification: {
            ...contactVerification,
            completedForCurrentFlow: true,
          },
        },
        outboundMessages: [],
      };
    }

    await this.auditService.record('patient.contact_confirmation.prompted', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      requiresPhoneUpdate: contactVerification.requiresPhoneUpdate,
      requiresEmailUpdate: contactVerification.requiresEmailUpdate,
    });

    return {
      nextState: this.state,
      outboundMessages: [
        this.patientContactConfirmationMessageFactory.build({
          fullName: contactVerification.fullName,
          primaryPhone: contactVerification.primaryPhone,
          primaryEmail: contactVerification.primaryEmail,
        }),
      ],
    };
  }
}
