import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { UpdatePatientContactDetailsUseCase } from '../../../patients/application/use-cases/update-patient-contact-details.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import { ContactUpdateCompletionService } from '../services/contact-update-completion.service';
import { PrimaryFlowContinuationResolverService } from '../services/primary-flow-continuation-resolver.service';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

const MAX_INVALID_EMAIL_ATTEMPTS = 3;

@Injectable()
export class UpdatingContactEmailHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.UPDATING_CONTACT_EMAIL;

  constructor(
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
    private readonly updatePatientContactDetails: UpdatePatientContactDetailsUseCase,
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
    private readonly patientContactUpdateSuccessMessageFactory: PatientContactUpdateSuccessMessageFactory,
    private readonly contactUpdateCompletionService: ContactUpdateCompletionService,
    private readonly primaryFlowContinuationResolver: PrimaryFlowContinuationResolverService,
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
    const selectedMode = contactVerification?.selectedUpdateMode;
    if (!contactVerification || !selectedMode) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
        },
        outboundMessages: [this.patientContactUpdateOptionsListFactory.build()],
      };
    }

    const normalizedEmail = this.patientContactInputValidator.normalizeEmail(
      event.textBody,
    );
    const currentPhone = this.patientContactInputValidator.normalizePhone(
      contactVerification.primaryPhone,
    );
    const verifiedPhone = contactVerification.verifiedPhone ?? undefined;
    const currentEmail = this.patientContactInputValidator.normalizeEmail(
      contactVerification.primaryEmail,
    );
    const hasValidEmail =
      normalizedEmail &&
      this.patientContactInputValidator.isValidEmail(normalizedEmail) &&
      normalizedEmail !== currentEmail;
    if (!hasValidEmail) {
      return this.handleInvalidEmailInput(
        session,
        contactVerification.invalidEmailAttempts + 1,
      );
    }

    if (selectedMode === 'BOTH' && !verifiedPhone) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: {
            ...contactVerification,
            pendingPhone: undefined,
            verifiedPhone: undefined,
            invalidEmailAttempts: 0,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'No fue posible conservar el numero confirmado para terminar la actualizacion. Selecciona una opcion para continuar.',
          },
          this.patientContactUpdateOptionsListFactory.build(),
        ],
      };
    }

    const resolvedVerifiedPhone = verifiedPhone!;
    const mode =
      selectedMode === 'BOTH' && resolvedVerifiedPhone !== currentPhone
        ? 'BOTH'
        : 'EMAIL';
    const updateResult = await this.updatePatientContactDetails.execute({
      patientId: session.context?.patientValidation?.patientId,
      mode,
      newPhone: mode === 'BOTH' ? resolvedVerifiedPhone : undefined,
      newEmail: normalizedEmail,
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: session.context?.flowIntent ?? 'UNKNOWN',
    });

    if (updateResult.status !== 'UPDATED') {
      const userFacingMessage = this.resolveEmailUpdateFailureMessage(
        updateResult,
      );
      await this.auditService.record('patient.contact_update.failed', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: mode,
        reason: updateResult.reason,
        technicalDetail:
          updateResult.status === 'TECHNICAL_FAILURE'
            ? updateResult.technicalDetail ?? null
            : null,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: {
            ...contactVerification,
            pendingPhone: undefined,
            verifiedPhone: undefined,
            invalidEmailAttempts: 0,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: userFacingMessage,
          },
          this.patientContactUpdateOptionsListFactory.build(),
        ],
      };
    }

    await this.auditService.record('patient.contact_update.persisted', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      updateMode: mode,
      phoneMasked: updateResult.phoneMasked,
      emailMasked: updateResult.emailMasked,
      result: updateResult.status,
    });

    if (selectedMode === 'BOTH') {
      return this.contactUpdateCompletionService.buildResult({
        session,
        verifiedPhone: resolvedVerifiedPhone,
        successMessage: this.patientContactUpdateSuccessMessageFactory.build(),
      });
    }

    if (session.context?.flowIntent === 'UPDATE_CONTACT') {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextStatus: CONVERSATION_STATUSES.CLOSED,
        nextContext: {
          ...session.context,
          flowIntent: undefined,
          appointmentNotificationsConsentPhone: undefined,
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
        ],
      };
    }

    return {
      continueFlow: this.primaryFlowContinuationResolver.shouldContinue(session),
      nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
      nextContext: {
        ...session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: contactVerification
          ? {
              ...contactVerification,
              completedForCurrentFlow: true,
              pendingPhone: undefined,
              verifiedPhone: undefined,
            }
          : undefined,
      },
      outboundMessages: [this.patientContactUpdateSuccessMessageFactory.build()],
    };
  }

  private async handleInvalidEmailInput(
    session: ConversationSession,
    attempts: number,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('patient.contact_update.validation_failed', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      updateMode:
        session.context?.contactVerification?.selectedUpdateMode ?? null,
      reason: 'INVALID_OR_REPEATED_EMAIL',
      attempts,
    });

    if (attempts >= MAX_INVALID_EMAIL_ATTEMPTS) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: session.context?.contactVerification
            ? {
                ...session.context.contactVerification,
                pendingPhone: undefined,
                verifiedPhone: undefined,
                invalidEmailAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Superaste el limite de intentos para correo. Selecciona una opcion para continuar.',
          },
          this.patientContactUpdateOptionsListFactory.build(),
        ],
      };
    }

    return {
      nextState: this.state,
      nextContext: {
        ...session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: session.context?.contactVerification
          ? {
              ...session.context.contactVerification,
              invalidEmailAttempts: attempts,
            }
          : undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'El correo debe ser valido y diferente al actual. Intenta nuevamente.',
        },
      ],
    };
  }

  private resolveEmailUpdateFailureMessage(
    result: Exclude<
      Awaited<ReturnType<UpdatePatientContactDetailsUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): string {
    if (result.status === 'VALIDATION_ERROR') {
      if (result.reason === 'SAME_EMAIL') {
        return 'El correo que escribiste ya corresponde a tu correo actual. Ingresa un correo diferente.';
      }

      if (
        result.reason === 'MISSING_EMAIL' ||
        result.reason === 'INVALID_EMAIL'
      ) {
        return 'El correo ingresado no es valido. Verifica el formato e intentalo nuevamente.';
      }
    }

    if (result.status === 'TECHNICAL_FAILURE') {
      if (result.reason === 'PATIENT_NOT_FOUND') {
        return 'No fue posible ubicar tu perfil para actualizar el correo. Vuelve a validar tu documento e intentalo nuevamente.';
      }

      if (
        result.reason === 'WRITE_DISABLED' ||
        result.reason === 'MISSING_WRITE_CONFIGURATION'
      ) {
        return 'La actualizacion de correo no esta habilitada en este momento. Intenta de nuevo en unos minutos.';
      }
    }

    return 'No fue posible actualizar el correo en este momento. Intenta nuevamente desde la lista de actualizacion.';
  }
}
