import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ContactPhoneRevalidationReason } from '../../domain/entities/conversation-session-context.entity';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import { PATIENT_CONTACT_CONFIRMATION_OPTION_IDS } from '../services/patient-contact-confirmation-option-id';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

type ContactVerificationContext = NonNullable<
  NonNullable<ConversationSession['context']>['contactVerification']
>;

@Injectable()
export class ConfirmingPatientContactHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT;

  constructor(
    private readonly patientContactConfirmationMessageFactory: PatientContactConfirmationMessageFactory,
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
    private readonly patientContactUpdateSuccessMessageFactory: PatientContactUpdateSuccessMessageFactory,
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
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
        },
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
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
        },
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

      if (this.shouldRedirectToContactUpdate(contactVerification)) {
        await this.auditService.record(
          'patient.contact_update.validation_failed',
          {
            conversationKey: session.conversationKey,
            patientId: session.context?.patientValidation?.patientId ?? null,
            flowIntent: session.context?.flowIntent ?? null,
            reason: 'REQUIRES_PHONE_REVALIDATION',
            phoneRevalidationReasons:
              this.resolvePhoneRevalidationReasons(contactVerification).join(
                ',',
              ) || null,
          },
        );

        return {
          nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
          nextContext: {
            ...session.context,
            appointmentNotificationsConsentPhone: undefined,
          },
          outboundMessages: [
            {
              type: 'text',
              body: 'Para continuar debes actualizar o verificar tu numero de telefono.',
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
          nextStatus: CONVERSATION_STATUSES.CLOSED,
          nextContext: {
            ...session.context,
            flowIntent: undefined,
            contactVerification: undefined,
            appointmentNotificationsConsentPhone: undefined,
            assignedAppointmentSelection: undefined,
            appointmentReschedule: undefined,
            specialtySelection: undefined,
            appointmentDoctorSelection: undefined,
            appointmentDateSelection: undefined,
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            this.patientContactUpdateSuccessMessageFactory.build(),
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: {
            ...contactVerification,
            completedForCurrentFlow: true,
            requiresPhoneRevalidation: false,
            phoneRevalidationReasons: [],
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

  private shouldRedirectToContactUpdate(
    contactVerification: ContactVerificationContext,
  ): boolean {
    if (contactVerification.requiresPhoneRevalidation === true) {
      return true;
    }

    if ((contactVerification.phoneRevalidationReasons?.length ?? 0) > 0) {
      return true;
    }

    return contactVerification.requiresPhoneUpdate;
  }

  private resolvePhoneRevalidationReasons(
    contactVerification: ContactVerificationContext,
  ): ContactPhoneRevalidationReason[] {
    if (contactVerification.phoneRevalidationReasons) {
      return contactVerification.phoneRevalidationReasons;
    }

    if (contactVerification.requiresPhoneRevalidation) {
      return ['INVALID_PHONE'];
    }

    if (contactVerification.requiresPhoneUpdate) {
      return ['INVALID_PHONE'];
    }

    return [];
  }
}
