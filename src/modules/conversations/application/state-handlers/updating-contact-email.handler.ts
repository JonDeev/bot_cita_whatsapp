import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { MarkPatientEmailVerifiedUseCase } from '../../../patients/application/use-cases/mark-patient-email-verified.use-case';
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
type ContactVerification = NonNullable<
  NonNullable<ConversationSession['context']>['contactVerification']
>;

@Injectable()
export class UpdatingContactEmailHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.UPDATING_CONTACT_EMAIL;

  constructor(
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
    private readonly markPatientEmailVerified: MarkPatientEmailVerifiedUseCase,
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
    const currentEmail = this.patientContactInputValidator.normalizeEmail(
      contactVerification.primaryEmail,
    );
    const currentPhone = this.patientContactInputValidator.normalizePhone(
      contactVerification.primaryPhone,
    );
    const verifiedPhone = contactVerification.verifiedPhone ?? undefined;

    if (
      !normalizedEmail ||
      !this.patientContactInputValidator.isValidEmail(normalizedEmail)
    ) {
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

    if (normalizedEmail === currentEmail) {
      return this.handleSameEmailInput({
        session,
        contactVerification,
        selectedMode,
        verifiedPhone,
        currentPhone,
        email: normalizedEmail,
      });
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

      return this.buildContactUpdateSelectionResult({
        session,
        contactVerification,
        message: userFacingMessage,
      });
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
              requiresPhoneRevalidation: false,
              phoneRevalidationReasons: [],
            }
          : undefined,
      },
      outboundMessages: [this.patientContactUpdateSuccessMessageFactory.build()],
    };
  }

  private async handleSameEmailInput(input: {
    session: ConversationSession;
    contactVerification: ContactVerification;
    selectedMode: NonNullable<ContactVerification['selectedUpdateMode']>;
    verifiedPhone: string | undefined;
    currentPhone: string | null;
    email: string;
  }): Promise<ConversationStateHandlerResult> {
    const patientId = input.session.context?.patientValidation?.patientId;
    const triggerFlowIntent = input.session.context?.flowIntent ?? 'UNKNOWN';

    const emailVerificationResult =
      await this.markPatientEmailVerified.execute({
        patientId,
        email: input.email,
        updatedBy: 'AdrianaBot',
        triggerFlowIntent,
      });

    if (emailVerificationResult.status !== 'UPDATED') {
      const userFacingMessage = this.resolveEmailVerificationFailureMessage(
        emailVerificationResult,
      );
      await this.auditService.record('patient.contact_update.failed', {
        conversationKey: input.session.conversationKey,
        patientId: input.session.context?.patientValidation?.patientId ?? null,
        flowIntent: input.session.context?.flowIntent ?? null,
        updateMode: input.selectedMode,
        reason: emailVerificationResult.reason,
        technicalDetail:
          emailVerificationResult.status === 'TECHNICAL_FAILURE'
            ? emailVerificationResult.technicalDetail ?? null
            : null,
      });

      return this.buildContactUpdateSelectionResult({
        session: input.session,
        contactVerification: input.contactVerification,
        message: userFacingMessage,
      });
    }

    await this.auditService.record(
      'patient.contact_update.email_verified_without_change',
      {
        conversationKey: input.session.conversationKey,
        patientId: input.session.context?.patientValidation?.patientId ?? null,
        flowIntent: input.session.context?.flowIntent ?? null,
        updateMode: input.selectedMode,
        emailMasked: emailVerificationResult.emailMasked,
        result: emailVerificationResult.status,
      },
    );

    if (
      input.selectedMode === 'BOTH' &&
      input.verifiedPhone !== input.currentPhone
    ) {
      const phoneUpdateResult = await this.updatePatientContactDetails.execute({
        patientId,
        mode: 'PHONE',
        newPhone: input.verifiedPhone,
        updatedBy: 'AdrianaBot',
        triggerFlowIntent,
      });

      if (phoneUpdateResult.status !== 'UPDATED') {
        const userFacingMessage = this.resolvePhoneUpdateFailureMessage(
          phoneUpdateResult,
        );
        await this.auditService.record('patient.contact_update.failed', {
          conversationKey: input.session.conversationKey,
          patientId: input.session.context?.patientValidation?.patientId ?? null,
          flowIntent: input.session.context?.flowIntent ?? null,
          updateMode: 'PHONE',
          reason: phoneUpdateResult.reason,
          technicalDetail:
            phoneUpdateResult.status === 'TECHNICAL_FAILURE'
              ? phoneUpdateResult.technicalDetail ?? null
              : null,
        });

        return this.buildContactUpdateSelectionResult({
          session: input.session,
          contactVerification: input.contactVerification,
          message: userFacingMessage,
        });
      }

      await this.auditService.record('patient.contact_update.persisted', {
        conversationKey: input.session.conversationKey,
        patientId: input.session.context?.patientValidation?.patientId ?? null,
        flowIntent: input.session.context?.flowIntent ?? null,
        updateMode: 'PHONE',
        phoneMasked: phoneUpdateResult.phoneMasked,
        emailMasked: phoneUpdateResult.emailMasked,
        result: phoneUpdateResult.status,
      });
    }

    if (input.selectedMode === 'BOTH') {
      return this.contactUpdateCompletionService.buildResult({
        session: input.session,
        verifiedPhone: input.verifiedPhone!,
        successMessage: this.patientContactUpdateSuccessMessageFactory.build(),
      });
    }

    if (input.session.context?.flowIntent === 'UPDATE_CONTACT') {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextStatus: CONVERSATION_STATUSES.CLOSED,
        nextContext: {
          ...input.session.context,
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
      continueFlow: this.primaryFlowContinuationResolver.shouldContinue(
        input.session,
      ),
      nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
      nextContext: {
        ...input.session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: {
          ...input.contactVerification,
          completedForCurrentFlow: true,
          pendingPhone: undefined,
          verifiedPhone: undefined,
          requiresPhoneRevalidation: false,
          phoneRevalidationReasons: [],
        },
      },
      outboundMessages: [this.patientContactUpdateSuccessMessageFactory.build()],
    };
  }

  private buildContactUpdateSelectionResult(input: {
    session: ConversationSession;
    contactVerification: ContactVerification | undefined;
    message: string;
  }): ConversationStateHandlerResult {
    return {
      nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
      nextContext: {
        ...input.session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: input.contactVerification
          ? {
              ...input.contactVerification,
              pendingPhone: undefined,
              verifiedPhone: undefined,
              invalidEmailAttempts: 0,
            }
          : undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: input.message,
        },
        this.patientContactUpdateOptionsListFactory.build(),
      ],
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
      reason: 'INVALID_EMAIL',
      attempts,
    });

    if (attempts >= MAX_INVALID_EMAIL_ATTEMPTS) {
      return this.buildContactUpdateSelectionResult({
        session,
        contactVerification: session.context?.contactVerification,
        message:
          'Superaste el limite de intentos para correo. Selecciona una opcion para continuar.',
      });
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
          body: 'El correo ingresado no es valido. Intenta nuevamente.',
        },
      ],
    };
  }

  private resolveEmailVerificationFailureMessage(
    result: Exclude<
      Awaited<ReturnType<MarkPatientEmailVerifiedUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): string {
    if (result.status === 'VALIDATION_ERROR') {
      if (
        result.reason === 'MISSING_EMAIL' ||
        result.reason === 'INVALID_EMAIL'
      ) {
        return 'El correo ingresado no es valido. Verifica el formato e intentalo nuevamente.';
      }

      if (result.reason === 'EMAIL_MISMATCH') {
        return 'No fue posible verificar tu correo con el registro actual. Vuelve a intentarlo.';
      }
    }

    if (result.status === 'TECHNICAL_FAILURE') {
      if (result.reason === 'PATIENT_NOT_FOUND') {
        return 'No fue posible ubicar tu perfil para verificar el correo. Vuelve a validar tu documento e intentalo nuevamente.';
      }

      if (
        result.reason === 'WRITE_DISABLED' ||
        result.reason === 'MISSING_WRITE_CONFIGURATION'
      ) {
        return 'La verificacion de correo no esta habilitada en este momento. Intenta de nuevo en unos minutos.';
      }
    }

    return 'No fue posible verificar el correo en este momento. Intenta nuevamente desde la lista de actualizacion.';
  }

  private resolveEmailUpdateFailureMessage(
    result: Exclude<
      Awaited<ReturnType<UpdatePatientContactDetailsUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): string {
    if (result.status === 'VALIDATION_ERROR') {
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

  private resolvePhoneUpdateFailureMessage(
    result: Exclude<
      Awaited<ReturnType<UpdatePatientContactDetailsUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): string {
    if (result.status === 'VALIDATION_ERROR') {
      if (
        result.reason === 'MISSING_PHONE' ||
        result.reason === 'INVALID_PHONE'
      ) {
        return 'El numero debe tener 10 digitos e iniciar por 3.';
      }
    }

    if (result.status === 'TECHNICAL_FAILURE') {
      if (result.reason === 'PATIENT_NOT_FOUND') {
        return 'No fue posible ubicar tu perfil para actualizar el telefono. Vuelve a validar tu documento e intentalo nuevamente.';
      }

      if (
        result.reason === 'WRITE_DISABLED' ||
        result.reason === 'MISSING_WRITE_CONFIGURATION'
      ) {
        return 'La actualizacion de telefono no esta habilitada en este momento. Intenta de nuevo en unos minutos.';
      }
    }

    return 'No fue posible actualizar el telefono en este momento. Intenta nuevamente desde la lista de actualizacion.';
  }
}
