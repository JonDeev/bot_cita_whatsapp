import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { SendWhatsappTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-template-message.use-case';
import {
  APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
  APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
  APPOINTMENT_REMINDER_PATIENT_CONTACT_REPOSITORY,
  APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import type { AppointmentReminderEligibilityRepository } from '../../domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderPatientContactRepository } from '../../domain/ports/appointment-reminder-patient-contact.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../../domain/ports/appointment-reminder-recipient-policy.repository';
import { AppointmentReminderButtonTokenService } from '../services/appointment-reminder-button-token.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';

export interface HandleAppointmentReminderVerificationReplyInput {
  inboundMessageId: string;
  fromPhone: string;
  interactiveReplyId: string;
  receivedAtIso: string;
}

export interface HandleAppointmentReminderVerificationReplyResult {
  handled: boolean;
}

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
    private readonly sendWhatsappTemplateMessage: SendWhatsappTemplateMessageUseCase,
    private readonly auditService: AuditService,
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
      recipientPhoneRaw: string;
      recipientPhoneE164: string | null;
      appointmentStartsAtIso: string;
      templateName: string;
    },
    input: HandleAppointmentReminderVerificationReplyInput,
  ): Promise<void> {
    await this.patientContactRepository.markPhoneVerified({
      patientLegacyUserId: dispatch.patientLegacyUserId,
      verifiedAtIso: input.receivedAtIso,
    });

    const hasSuppression =
      await this.recipientPolicyRepository.hasActiveSuppression({
        patientLegacyUserId: dispatch.patientLegacyUserId,
        phone: dispatch.recipientPhoneE164 ?? dispatch.recipientPhoneRaw,
      });
    if (hasSuppression) {
      await this.dispatchRepository.markPostVerificationSkipped({
        dispatchId: dispatch.id,
        status: 'SKIPPED_SUPPRESSED_CONTACT',
      });
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
      minimumHours: this.configService.getVerificationGraceHours(),
    });

    if (!canStillSend) {
      await this.dispatchRepository.markPostVerificationSkipped({
        dispatchId: dispatch.id,
        status: 'SKIPPED_LATE_CONFIRMATION',
      });
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

    const latestAppointment = (
      await this.eligibilityRepository.findByLegacyAgendaIds([
        dispatch.legacyAgendaId,
      ])
    )[0];

    if (!latestAppointment || latestAppointment.legacyState !== 'Asignada') {
      await this.dispatchRepository.markPostVerificationSkipped({
        dispatchId: dispatch.id,
        status: 'SKIPPED_APPOINTMENT_CANCELLED',
      });
      await this.dispatchRepository.markInboundDedupProcessed({
        provider: 'META_WHATSAPP',
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.interactiveReplyId,
        processedAtIso: input.receivedAtIso,
        resultStatus: 'PROCESSED_APPOINTMENT_CANCELLED',
      });
      return;
    }

    const recipientPhone =
      dispatch.recipientPhoneE164 ??
      this.phoneNormalizer.toE164Colombia(
        this.phoneNormalizer.normalizeLegacyPhone(dispatch.recipientPhoneRaw) ??
          dispatch.recipientPhoneRaw,
      );

    const sendResult = await this.sendWhatsappTemplateMessage.execute({
      to: recipientPhone,
      templateName: dispatch.templateName,
      languageCode: this.templateConfig.getTemplateLanguageCode(),
      bodyTextParameters: this.buildReminderBodyParameters(latestAppointment),
      trigger: 'appointment_reminder.phone_confirmed',
    });

    await this.dispatchRepository.markPostVerificationSent({
      dispatchId: dispatch.id,
      metaMessageId: sendResult.messageId,
      sentAtIso: input.receivedAtIso,
    });

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

    await this.dispatchRepository.markPostVerificationSkipped({
      dispatchId: dispatch.id,
      status: 'SKIPPED_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON',
    });

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
