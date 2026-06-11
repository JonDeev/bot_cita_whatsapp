import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { MarkPatientPhoneVerifiedUseCase } from '../../../patients/application/use-cases/mark-patient-phone-verified.use-case';
import { UpdatePatientContactDetailsUseCase } from '../../../patients/application/use-cases/update-patient-contact-details.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import { ContactUpdateCompletionService } from '../services/contact-update-completion.service';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

const MAX_INVALID_PHONE_ATTEMPTS = 3;
type PhoneUpdateMode = 'PHONE' | 'BOTH';

@Injectable()
export class UpdatingContactPhoneHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.UPDATING_CONTACT_PHONE;

  constructor(
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
    private readonly markPatientPhoneVerified: MarkPatientPhoneVerifiedUseCase,
    private readonly updatePatientContactDetails: UpdatePatientContactDetailsUseCase,
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
    private readonly patientContactUpdateSuccessMessageFactory: PatientContactUpdateSuccessMessageFactory,
    private readonly contactUpdateCompletionService: ContactUpdateCompletionService,
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
    const phoneUpdateMode = this.resolvePhoneUpdateMode(selectedMode);
    if (!phoneUpdateMode) {
      await this.auditService.record('patient.contact_update.invalid_state', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: selectedMode,
        state: this.state,
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
            invalidPhoneAttempts: 0,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Selecciona nuevamente el dato de contacto que deseas actualizar.',
          },
          this.patientContactUpdateOptionsListFactory.build(),
        ],
      };
    }

    const normalizedPhone = this.patientContactInputValidator.normalizePhone(
      event.textBody,
    );
    const normalizedPhoneValue = normalizedPhone ?? undefined;
    const currentPhone = this.patientContactInputValidator.normalizePhone(
      contactVerification.primaryPhone,
    );
    const hasValidPhone = Boolean(
      normalizedPhone &&
        this.patientContactInputValidator.isValidColombianMobilePhone(
          normalizedPhone,
        ),
    );
    const isSameValidPhone =
      hasValidPhone &&
      currentPhone !== null &&
      normalizedPhone === currentPhone;

    if (!hasValidPhone) {
      return this.handleInvalidPhoneInput(
        session,
        contactVerification.invalidPhoneAttempts + 1,
      );
    }

    if (isSameValidPhone) {
      await this.auditService.record(
        'patient.contact_update.phone_confirmed_without_change',
        {
          conversationKey: session.conversationKey,
          patientId: session.context?.patientValidation?.patientId ?? null,
          flowIntent: session.context?.flowIntent ?? null,
          updateMode: phoneUpdateMode,
          result: 'NO_CHANGE_ACCEPTED',
        },
      );
    }

    if (phoneUpdateMode === 'BOTH') {
      if (isSameValidPhone) {
        const verificationResult = await this.markPatientPhoneVerified.execute({
          patientId: session.context?.patientValidation?.patientId,
          phone: normalizedPhoneValue,
          updatedBy: 'AdrianaBot',
          triggerFlowIntent: session.context?.flowIntent ?? 'UNKNOWN',
        });
        if (verificationResult.status !== 'UPDATED') {
          return this.handlePhoneVerificationFailure(
            session,
            contactVerification,
            phoneUpdateMode,
            verificationResult,
          );
        }

        await this.auditService.record(
          'patient.contact_update.phone_verification_persisted',
          {
            conversationKey: session.conversationKey,
            patientId: session.context?.patientValidation?.patientId ?? null,
            flowIntent: session.context?.flowIntent ?? null,
            updateMode: phoneUpdateMode,
            phoneMasked: verificationResult.phoneMasked,
          },
        );

        return {
          nextState: CONVERSATION_STATES.UPDATING_CONTACT_EMAIL,
          nextContext: {
            ...session.context,
            appointmentNotificationsConsentPhone: undefined,
            contactVerification: {
              ...contactVerification,
              pendingPhone: undefined,
              verifiedPhone: normalizedPhoneValue,
              invalidPhoneAttempts: 0,
            },
          },
          outboundMessages: [
            {
              type: 'text',
              body: 'Ahora escribe tu nuevo correo electronico.',
            },
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.UPDATING_CONTACT_EMAIL,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: {
            ...contactVerification,
            pendingPhone: undefined,
            verifiedPhone: normalizedPhoneValue,
            invalidPhoneAttempts: 0,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Ahora escribe tu nuevo correo electronico.',
          },
        ],
      };
    }

    if (isSameValidPhone) {
      const verificationResult = await this.markPatientPhoneVerified.execute({
        patientId: session.context?.patientValidation?.patientId,
        phone: normalizedPhoneValue,
        updatedBy: 'AdrianaBot',
        triggerFlowIntent: session.context?.flowIntent ?? 'UNKNOWN',
      });
      if (verificationResult.status !== 'UPDATED') {
        return this.handlePhoneVerificationFailure(
          session,
          contactVerification,
          phoneUpdateMode,
          verificationResult,
        );
      }

      await this.auditService.record(
        'patient.contact_update.phone_verification_persisted',
        {
          conversationKey: session.conversationKey,
          patientId: session.context?.patientValidation?.patientId ?? null,
          flowIntent: session.context?.flowIntent ?? null,
          updateMode: phoneUpdateMode,
          phoneMasked: verificationResult.phoneMasked,
        },
      );

      return this.contactUpdateCompletionService.buildResult({
        session,
        verifiedPhone: normalizedPhone!,
        successMessage: this.patientContactUpdateSuccessMessageFactory.build(),
      });
    }

    const updateResult = await this.updatePatientContactDetails.execute({
      patientId: session.context?.patientValidation?.patientId,
      mode: 'PHONE',
      newPhone: normalizedPhoneValue,
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: session.context?.flowIntent ?? 'UNKNOWN',
    });

    if (updateResult.status !== 'UPDATED') {
      const userFacingMessage = this.resolvePhoneUpdateFailureMessage(
        updateResult,
      );
      await this.auditService.record('patient.contact_update.failed', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        flowIntent: session.context?.flowIntent ?? null,
        updateMode: 'PHONE',
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
          contactVerification: {
            ...contactVerification,
            invalidPhoneAttempts: 0,
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
      updateMode: 'PHONE',
      phoneMasked: updateResult.phoneMasked,
      emailMasked: updateResult.emailMasked,
      result: updateResult.status,
    });

    return this.contactUpdateCompletionService.buildResult({
      session,
      verifiedPhone: normalizedPhone!,
      successMessage: this.patientContactUpdateSuccessMessageFactory.build(),
    });
  }

  private async handlePhoneVerificationFailure(
    session: ConversationSession,
    contactVerification: NonNullable<
      ConversationSession['context']
    >['contactVerification'],
    updateMode: PhoneUpdateMode,
    result: Exclude<
      Awaited<ReturnType<MarkPatientPhoneVerifiedUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('patient.contact_update.failed', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      updateMode,
      reason: result.reason,
      technicalDetail:
        result.status === 'TECHNICAL_FAILURE'
          ? result.technicalDetail ?? null
          : null,
    });

    return {
      nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
      nextContext: {
        ...session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: contactVerification
          ? {
              ...contactVerification,
              pendingPhone: undefined,
              verifiedPhone: undefined,
              invalidPhoneAttempts: 0,
            }
          : undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'No fue posible confirmar este numero en este momento. Selecciona una opcion para continuar.',
        },
        this.patientContactUpdateOptionsListFactory.build(),
      ],
    };
  }

  private resolvePhoneUpdateMode(
    selectedMode: NonNullable<
      NonNullable<ConversationSession['context']>['contactVerification']
    >['selectedUpdateMode'],
  ): PhoneUpdateMode | null {
    if (selectedMode === 'PHONE' || selectedMode === 'BOTH') {
      return selectedMode;
    }

    return null;
  }

  private async handleInvalidPhoneInput(
    session: ConversationSession,
    attempts: number,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('patient.contact_update.validation_failed', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      flowIntent: session.context?.flowIntent ?? null,
      updateMode:
        session.context?.contactVerification?.selectedUpdateMode ?? null,
      reason: 'INVALID_OR_REPEATED_PHONE',
      attempts,
    });

    if (attempts >= MAX_INVALID_PHONE_ATTEMPTS) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: session.context?.contactVerification
            ? {
                ...session.context.contactVerification,
                invalidPhoneAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Superaste el limite de intentos para telefono. Selecciona una opcion para continuar.',
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
              invalidPhoneAttempts: attempts,
            }
          : undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'El numero debe tener 10 digitos e iniciar por 3. Intenta nuevamente.',
        },
      ],
    };
  }

  private resolvePhoneUpdateFailureMessage(
    result: Exclude<
      Awaited<ReturnType<UpdatePatientContactDetailsUseCase['execute']>>,
      { status: 'UPDATED' }
    >,
  ): string {
    if (result.status === 'VALIDATION_ERROR') {
      if (result.reason === 'SAME_PHONE') {
        return 'El numero que escribiste ya corresponde a tu telefono actual. Ingresa un numero diferente.';
      }

      if (
        result.reason === 'MISSING_PHONE' ||
        result.reason === 'INVALID_PHONE'
      ) {
        return 'El telefono debe tener 10 digitos e iniciar por 3.';
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
