import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import {
  APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
  APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
  APPOINTMENT_REMINDER_PATIENT_CONTACT_REPOSITORY,
  APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import type {
  AppointmentReminderEligibilityRepository,
  EligibleAppointmentForReminder,
} from '../../domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderPatientContactRepository } from '../../domain/ports/appointment-reminder-patient-contact.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../../domain/ports/appointment-reminder-recipient-policy.repository';
import { AppointmentReminderButtonTokenService } from '../services/appointment-reminder-button-token.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderTemplateDeliveryService } from '../services/appointment-reminder-template-delivery.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import {
  APPOINTMENT_REMINDER_VERIFICATION_CONSENT_SOURCE,
  buildAppointmentReminderVerificationConsentText,
} from '../services/appointment-reminder-verification-consent';

export interface HandleAppointmentReminderVerificationReplyInput {
  inboundMessageId: string;
  fromPhone: string;
  interactiveReplyId: string;
  receivedAtIso: string;
}

export interface HandleAppointmentReminderVerificationReplyResult {
  handled: boolean;
}

type LatestAppointmentLookupResult =
  | {
      status: 'FOUND';
      appointment: EligibleAppointmentForReminder;
    }
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'LOOKUP_FAILED';
      errorMessage: string;
    };

type LegacyPhoneVerificationSyncResult =
  | {
      status: 'UPDATED' | 'PATIENT_NOT_FOUND' | 'WRITE_DISABLED';
    }
  | {
      status: 'FAILED';
      errorMessage: string;
      attempts: number;
    };

@Injectable()
export class HandleAppointmentReminderVerificationReplyUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_DISPATCH_REPOSITORY)
    private readonly dispatchRepository: AppointmentReminderDispatchRepository,
    @Inject(APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY)
    private readonly eligibilityRepository: AppointmentReminderEligibilityRepository,
    @Inject(APPOINTMENT_REMINDER_PATIENT_CONTACT_REPOSITORY)
    private readonly patientContactRepository: AppointmentReminderPatientContactRepository,
    @Inject(APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY)
    private readonly recipientPolicyRepository: AppointmentReminderRecipientPolicyRepository,
    private readonly templateConfig: AppointmentReminderTemplateConfigService,
    private readonly tokenService: AppointmentReminderButtonTokenService,
    private readonly windowService: AppointmentReminderWindowService,
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly phoneNormalizer: AppointmentReminderPhoneNormalizerService,
    private readonly templateDeliveryService: AppointmentReminderTemplateDeliveryService,
    private readonly registerWhatsappPostBookingConsent: RegisterWhatsappPostBookingConsentUseCase,
    private readonly auditService: AuditService,
    private readonly runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(
    input: HandleAppointmentReminderVerificationReplyInput,
  ): Promise<HandleAppointmentReminderVerificationReplyResult> {
    const action = this.resolveAction(input.interactiveReplyId);
    if (!action) {
      return { handled: false };
    }

    const token = input.interactiveReplyId.slice(action.prefix.length);
    const verifiedToken = this.tokenService.verifyToken(token);
    if (!verifiedToken) {
      await this.auditService.record(
        'appointment_reminder.inbound.invalid_token',
        {
          inboundMessageId: input.inboundMessageId,
        },
      );
      return { handled: true };
    }

    const dedupAccepted = await this.dispatchRepository.recordInboundDedup({
      provider: 'META_WHATSAPP',
      inboundMessageId: input.inboundMessageId,
      buttonPayloadId: input.interactiveReplyId,
      receivedAtIso: input.receivedAtIso,
      resultStatus: 'RECEIVED',
    });

    if (!dedupAccepted) {
      await this.auditService.record(
        'appointment_reminder.inbound.duplicate_ignored',
        {
          inboundMessageId: input.inboundMessageId,
        },
      );
      return { handled: true };
    }

    const dispatch = await this.dispatchRepository.findById(
      verifiedToken.dispatchId,
    );
    if (!dispatch || dispatch.status !== 'PHONE_VERIFICATION_PENDING') {
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'SKIPPED_INVALID_DISPATCH',
      });
      return { handled: true };
    }

    const expectedTokenHash = this.tokenService.hashToken(token);
    if (dispatch.verificationTokenHash !== expectedTokenHash) {
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'SKIPPED_INVALID_TOKEN_HASH',
      });
      return { handled: true };
    }

    const normalizedIncomingPhone = input.fromPhone.replace(/\D+/g, '');
    const expectedPhone = (
      dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw
    ).replace(/\D+/g, '');

    if (normalizedIncomingPhone !== expectedPhone) {
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'SKIPPED_PHONE_MISMATCH',
      });
      return { handled: true };
    }

    if (action.type === 'REJECT') {
      await this.processReject(dispatch, input);
      return { handled: true };
    }

    await this.processConfirm(dispatch, input);
    return { handled: true };
  }

  private async processConfirm(
    dispatch: {
      id: number;
      legacyAgendaId: number;
      patientLegacyUserId: number;
      conversationKey: string | null;
      recipientPhoneRaw: string;
      recipientPhoneE164: string | null;
      appointmentStartsAtIso: string;
      templateName: string;
    },
    input: HandleAppointmentReminderVerificationReplyInput,
  ): Promise<void> {
    const latestAppointmentResult = await this.resolveLatestAppointment(
      dispatch.id,
      dispatch.legacyAgendaId,
    );
    const latestAppointment =
      latestAppointmentResult.status === 'FOUND'
        ? latestAppointmentResult.appointment
        : null;
    const patientDisplayName = latestAppointment
      ? `${latestAppointment.patientFirstName} ${latestAppointment.patientLastName}`.trim()
      : 'Paciente';
    const consentTextSnapshot =
      buildAppointmentReminderVerificationConsentText(patientDisplayName);

    let consentResult: { status: 'RECORDED' | 'SKIPPED' } | undefined;
    try {
      consentResult = await this.registerWhatsappPostBookingConsent.execute({
        patientId: dispatch.patientLegacyUserId,
        phone: dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw,
        granted: true,
        consentTextSnapshot,
        source: APPOINTMENT_REMINDER_VERIFICATION_CONSENT_SOURCE,
        respondedAtIso: input.receivedAtIso,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record(
        'appointment_reminder.phone_confirmed_consent_persist_failed',
        {
          dispatchId: dispatch.id,
          patientLegacyUserId: dispatch.patientLegacyUserId,
          errorMessage,
        },
      );
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_CONSENT_PERSIST_FAILED',
      });
      return;
    }

    await this.auditService.record(
      'appointment_reminder.phone_confirmed_consent_recorded',
      {
        dispatchId: dispatch.id,
        patientLegacyUserId: dispatch.patientLegacyUserId,
        consentStatus: consentResult!.status,
        consentSource: APPOINTMENT_REMINDER_VERIFICATION_CONSENT_SOURCE,
      },
    );

    const verifiedPhoneResult = await this.syncLegacyPhoneVerification({
      patientLegacyUserId: dispatch.patientLegacyUserId,
      verifiedAtIso: input.receivedAtIso,
    });
    if (verifiedPhoneResult.status !== 'UPDATED') {
      await this.auditService.record(
        'appointment_reminder.phone_confirmed_phone_write_failed',
        {
          dispatchId: dispatch.id,
          patientLegacyUserId: dispatch.patientLegacyUserId,
          writeResult: verifiedPhoneResult.status,
          attempts:
            verifiedPhoneResult.status === 'FAILED'
              ? verifiedPhoneResult.attempts
              : undefined,
          errorMessage:
            verifiedPhoneResult.status === 'FAILED'
              ? verifiedPhoneResult.errorMessage
              : undefined,
        },
      );
    }

    const clearedUnknownPersonSuppression =
      await this.recipientPolicyRepository.clearUnknownPersonSuppression({
        patientLegacyUserId: dispatch.patientLegacyUserId,
        phone: dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw,
      });
    if (clearedUnknownPersonSuppression) {
      await this.auditService.record(
        'appointment_reminder.phone_confirmed_suppression_cleared',
        {
          dispatchId: dispatch.id,
          patientLegacyUserId: dispatch.patientLegacyUserId,
        },
      );
    }

    const hasSuppression =
      await this.recipientPolicyRepository.hasActiveSuppression({
        patientLegacyUserId: dispatch.patientLegacyUserId,
        phone: dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw,
      });
    if (hasSuppression) {
      const markedSkipped =
        await this.dispatchRepository.markPostVerificationSkipped({
          dispatchId: dispatch.id,
          status: 'SKIPPED_SUPPRESSED_CONTACT',
        });
      if (!markedSkipped) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            skipStatus: 'SKIPPED_SUPPRESSED_CONTACT',
          },
        );
      }
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_SUPPRESSED_CONTACT',
      });
      return;
    }

    const canStillSend = this.windowService.hasAtLeastHoursBeforeAppointment({
      appointmentStartsAtIso: dispatch.appointmentStartsAtIso,
      referenceIso: input.receivedAtIso,
      minimumHours: await this.resolveMinConfirmationHours(),
    });

    if (!canStillSend) {
      const markedSkipped =
        await this.dispatchRepository.markPostVerificationSkipped({
          dispatchId: dispatch.id,
          status: 'SKIPPED_LATE_CONFIRMATION',
        });
      if (!markedSkipped) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            skipStatus: 'SKIPPED_LATE_CONFIRMATION',
          },
        );
      }
      await this.auditService.record(
        'appointment_reminder.dispatch.skipped_late_confirmation',
        {
          dispatchId: dispatch.id,
        },
      );
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_LATE_CONFIRMATION',
      });
      return;
    }

    if (latestAppointmentResult.status === 'LOOKUP_FAILED') {
      const paused =
        await this.dispatchRepository.markPostVerificationPausedHold({
          dispatchId: dispatch.id,
          reason: 'appointment_lookup_failed_after_confirmation',
        });
      if (!paused) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            pauseHold: true,
            reason: 'appointment_lookup_failed_after_confirmation',
          },
        );
      } else {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_lookup_deferred',
          {
            dispatchId: dispatch.id,
            legacyAgendaId: dispatch.legacyAgendaId,
            errorMessage: latestAppointmentResult.errorMessage,
          },
        );
      }
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_APPOINTMENT_LOOKUP_FAILED',
      });
      return;
    }

    if (
      latestAppointmentResult.status === 'NOT_FOUND' ||
      !latestAppointment ||
      latestAppointment.legacyState !== 'Asignada'
    ) {
      const markedSkipped =
        await this.dispatchRepository.markPostVerificationSkipped({
          dispatchId: dispatch.id,
          status: 'SKIPPED_APPOINTMENT_CANCELLED',
        });
      if (!markedSkipped) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            skipStatus: 'SKIPPED_APPOINTMENT_CANCELLED',
          },
        );
      }
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_APPOINTMENT_CANCELLED',
      });
      return;
    }

    const confirmedAppointment = latestAppointment;

    const conversationKey = this.resolveConversationKey(dispatch);
    const hasHandOffActive =
      await this.recipientPolicyRepository.isHumanHandoffActive({
        conversationKey,
      });
    if (hasHandOffActive) {
      const markedSkipped =
        await this.dispatchRepository.markPostVerificationSkipped({
          dispatchId: dispatch.id,
          status: 'SKIPPED_HANDOFF_ACTIVE',
        });
      if (!markedSkipped) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            skipStatus: 'SKIPPED_HANDOFF_ACTIVE',
          },
        );
      }
      await this.auditService.record(
        'appointment_reminder.phone_confirmed_handoff_active',
        {
          dispatchId: dispatch.id,
        },
      );
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_HANDOFF_ACTIVE',
      });
      return;
    }

    if (await this.isEmergencyPauseActive()) {
      const paused =
        await this.dispatchRepository.markPostVerificationPausedHold({
          dispatchId: dispatch.id,
          reason: 'emergency_pause_active',
        });
      if (!paused) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            pauseHold: true,
          },
        );
      } else {
        await this.auditService.record(
          'appointment_reminder.dispatch.paused_hold',
          {
            dispatchId: dispatch.id,
            source: 'post_verification_confirm',
          },
        );
      }
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_PAUSED_HOLD',
      });
      return;
    }

    const hasOptIn =
      await this.recipientPolicyRepository.hasAppointmentNotificationsOptIn({
        patientLegacyUserId: dispatch.patientLegacyUserId,
      });
    if (!hasOptIn) {
      const markedSkipped =
        await this.dispatchRepository.markPostVerificationSkipped({
          dispatchId: dispatch.id,
          status: 'SKIPPED_NO_OPT_IN',
        });
      if (!markedSkipped) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            skipStatus: 'SKIPPED_NO_OPT_IN',
          },
        );
      }
      await this.auditService.record(
        'appointment_reminder.phone_confirmed_no_opt_in',
        {
          dispatchId: dispatch.id,
        },
      );
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_NO_OPT_IN',
      });
      return;
    }

    const recipientPhone =
      dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw;

    const sendResult = await this.templateDeliveryService.send({
      conversationKey,
      dispatchId: dispatch.id,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      to: recipientPhone,
      templateName: dispatch.templateName,
      languageCode: this.templateConfig.getTemplateLanguageCode(),
      bodyTextParameters: this.buildReminderBodyParameters(confirmedAppointment),
      trigger: 'appointment_reminder.phone_confirmed',
    });

    const markedSent = await this.dispatchRepository.markPostVerificationSent({
      dispatchId: dispatch.id,
      metaMessageId: sendResult.messageId,
      sentAtIso: input.receivedAtIso,
    });
    if (!markedSent) {
      const compensated =
        await this.dispatchRepository.markPostVerificationSentAfterUncertainOwnership(
          {
            dispatchId: dispatch.id,
            metaMessageId: sendResult.messageId,
            sentAtIso: input.receivedAtIso,
          },
        );
      if (compensated) {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_compensated',
          {
            dispatchId: dispatch.id,
            messageId: sendResult.messageId,
          },
        );
      } else {
        await this.auditService.record(
          'appointment_reminder.phone_confirmed_state_lost',
          {
            dispatchId: dispatch.id,
            messageId: sendResult.messageId,
          },
        );
      }
    }

    await this.auditService.record('appointment_reminder.phone_confirmed', {
      dispatchId: dispatch.id,
      messageId: sendResult.messageId,
    });

    await this.dispatchRepository.markInboundDedupProcessed({
      provider: 'META_WHATSAPP',
      inboundMessageId: input.inboundMessageId,
      buttonPayloadId: input.interactiveReplyId,
      processedAtIso: input.receivedAtIso,
      resultStatus: 'PROCESSED_CONFIRMED',
    });
  }

  private async resolveLatestAppointment(
    dispatchId: number,
    legacyAgendaId: number,
  ): Promise<LatestAppointmentLookupResult> {
    try {
      const appointment = (
        await this.eligibilityRepository.findByLegacyAgendaIds([legacyAgendaId])
      )[0];
      if (!appointment) {
        return { status: 'NOT_FOUND' };
      }

      return {
        status: 'FOUND',
        appointment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record(
        'appointment_reminder.latest_appointment_lookup_failed',
        {
          dispatchId,
          legacyAgendaId,
          errorMessage,
        },
      );
      return {
        status: 'LOOKUP_FAILED',
        errorMessage,
      };
    }
  }

  private async syncLegacyPhoneVerification(input: {
    patientLegacyUserId: number;
    verifiedAtIso: string;
  }): Promise<LegacyPhoneVerificationSyncResult> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.patientContactRepository.markPhoneVerified(
          input,
        );

        if (result === 'UPDATED') {
          return { status: 'UPDATED' };
        }

        if (result === 'PATIENT_NOT_FOUND') {
          return { status: 'PATIENT_NOT_FOUND' };
        }

        return { status: 'WRITE_DISABLED' };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        if (attempt >= maxAttempts) {
          return {
            status: 'FAILED',
            errorMessage,
            attempts: attempt,
          };
        }
      }
    }

    return {
      status: 'FAILED',
      errorMessage: 'Unexpected legacy phone verification sync fallthrough.',
      attempts: maxAttempts,
    };
  }

  private async resolveMinConfirmationHours(): Promise<number> {
    if (this.runtimeResolver) {
      return (
        await this.runtimeResolver.resolveEffectiveHotReloadableSettings()
      ).minConfirmationHours;
    }

    return this.configService.getVerificationGraceHours();
  }

  private async isEmergencyPauseActive(): Promise<boolean> {
    if (!this.runtimeResolver) {
      return false;
    }

    return this.runtimeResolver.isEmergencyPauseActive();
  }

  private resolveConversationKey(dispatch: {
    conversationKey: string | null;
    recipientPhoneE164: string | null;
    recipientPhoneRaw: string;
  }): string {
    if (dispatch.conversationKey?.trim()) {
      return dispatch.conversationKey;
    }

    const phoneNumberId = this.configService.getWhatsAppPhoneNumberId();
    const recipientPhone =
      dispatch.recipientPhoneE164 ??
      this.phoneNormalizer.toE164Colombia(
        this.phoneNormalizer.normalizeLegacyPhone(dispatch.recipientPhoneRaw) ??
          dispatch.recipientPhoneRaw,
      );

    return `whatsapp:${phoneNumberId || 'unknown'}:${recipientPhone}`;
  }

  private async processReject(
    dispatch: {
      id: number;
      patientLegacyUserId: number;
      recipientPhoneRaw: string;
      recipientPhoneE164: string | null;
    },
    input: HandleAppointmentReminderVerificationReplyInput,
  ): Promise<void> {
    await this.patientContactRepository.clearPhoneAndVerification({
      patientLegacyUserId: dispatch.patientLegacyUserId,
    });

    await this.recipientPolicyRepository.upsertUnknownPersonSuppression({
      patientLegacyUserId: dispatch.patientLegacyUserId,
      phone: dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw,
      notes: 'Patient rejected phone ownership via reminder verification.',
    });

    const markedSkipped =
      await this.dispatchRepository.markPostVerificationSkipped({
        dispatchId: dispatch.id,
        status: 'SKIPPED_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      });
    if (!markedSkipped) {
      await this.auditService.record(
        'appointment_reminder.phone_rejected_state_lost',
        {
          dispatchId: dispatch.id,
        },
      );
    }

    await this.auditService.record(
      'appointment_reminder.phone_rejected_unknown_person',
      {
        dispatchId: dispatch.id,
      },
    );

    await this.dispatchRepository.markInboundDedupProcessed({
      provider: 'META_WHATSAPP',
      inboundMessageId: input.inboundMessageId,
      buttonPayloadId: input.interactiveReplyId,
      processedAtIso: input.receivedAtIso,
      resultStatus: 'PROCESSED_REJECTED',
    });
  }

  private resolveAction(interactiveReplyId: string): {
    type: 'CONFIRM' | 'REJECT';
    prefix: string;
  } | null {
    if (
      interactiveReplyId.startsWith(
        this.templateConfig.getConfirmButtonPayloadPrefix(),
      )
    ) {
      return {
        type: 'CONFIRM',
        prefix: this.templateConfig.getConfirmButtonPayloadPrefix(),
      };
    }

    if (
      interactiveReplyId.startsWith(
        this.templateConfig.getRejectButtonPayloadPrefix(),
      )
    ) {
      return {
        type: 'REJECT',
        prefix: this.templateConfig.getRejectButtonPayloadPrefix(),
      };
    }

    return null;
  }

  private buildReminderBodyParameters(input: {
    patientFirstName: string;
    patientLastName: string;
    specialtyName: string | null;
    modalityId: number;
    appointmentDateIso: string;
    appointmentTimeHhmm: string;
    siteCity: string | null;
    siteAddress: string | null;
    doctorName: string | null;
  }): string[] {
    const patientName =
      `${input.patientFirstName} ${input.patientLastName}`.trim();
    const day = new Date(input.appointmentDateIso).toISOString().slice(0, 10);

    return [
      patientName || 'Paciente',
      input.specialtyName ?? 'Consulta medica',
      input.modalityId === 0 ? 'PRESENCIAL' : '',
      day,
      input.appointmentTimeHhmm,
      input.siteCity ?? '',
      input.siteAddress ?? '',
      input.doctorName ?? '',
    ];
  }
}
