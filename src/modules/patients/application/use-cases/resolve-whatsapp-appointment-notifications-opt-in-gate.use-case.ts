import { Inject, Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import {
  PATIENT_CONTACT_PROFILE_REPOSITORY,
  WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY,
} from '../../domain/patients.tokens';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import type { WhatsappContactConsentReaderRepository } from '../../domain/ports/whatsapp-contact-consent-reader.repository';
import {
  WHATSAPP_CONTACT_CONSENT_CHANNEL,
  WHATSAPP_CONTACT_CONSENT_PURPOSES,
} from '../../domain/ports/whatsapp-contact-consent.repository';

export type ResolveWhatsappAppointmentNotificationsOptInGateResult =
  | {
      status: 'PROMPT_REQUIRED';
      reason:
        | 'INVALID_PATIENT_ID'
        | 'INVALID_PHONE'
        | 'PATIENT_NOT_FOUND'
        | 'PHONE_NOT_VERIFIED'
        | 'PHONE_MISMATCH'
        | 'CONSENT_NOT_GRANTED'
        | 'CONSENT_PHONE_MISMATCH'
        | 'CONSENT_TIMESTAMP_MISSING'
        | 'CONSENT_OUTDATED_AFTER_PHONE_VERIFICATION'
        | 'INVALID_PHONE_VERIFIED_AT'
        | 'INVALID_CONSENT_GRANTED_AT';
    }
  | {
      status: 'PROMPT_NOT_REQUIRED';
      consentGrantedAtIso: string;
      phoneVerifiedAtIso: string;
    };

@Injectable()
export class ResolveWhatsappAppointmentNotificationsOptInGateUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    @Inject(WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY)
    private readonly whatsappContactConsentReaderRepository: WhatsappContactConsentReaderRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(input: {
    patientId: number | null | undefined;
    whatsappPhone: string | null | undefined;
  }): Promise<ResolveWhatsappAppointmentNotificationsOptInGateResult> {
    const patientId = this.normalizePatientId(input.patientId);
    if (patientId === null) {
      return { status: 'PROMPT_REQUIRED', reason: 'INVALID_PATIENT_ID' };
    }

    const whatsappPhone = this.patientContactInputValidator.normalizePhone(
      input.whatsappPhone,
    );
    if (!whatsappPhone) {
      return { status: 'PROMPT_REQUIRED', reason: 'INVALID_PHONE' };
    }

    const profile = await this.patientContactProfileRepository.findByPatientId(
      patientId,
    );
    if (!profile) {
      return { status: 'PROMPT_REQUIRED', reason: 'PATIENT_NOT_FOUND' };
    }

    const consent =
      await this.whatsappContactConsentReaderRepository.findConsentByPatientAndPurpose(
        {
          patientLegacyUserId: patientId,
          channel: WHATSAPP_CONTACT_CONSENT_CHANNEL,
          purpose:
            WHATSAPP_CONTACT_CONSENT_PURPOSES.APPOINTMENT_NOTIFICATIONS,
        },
      );

    if (!profile.phoneVerifiedAtIso) {
      if (
        consent?.granted &&
        this.patientContactInputValidator.isSamePhoneNumber(
          consent.phone,
          whatsappPhone,
        ) &&
        consent.grantedAtIso
      ) {
        return {
          status: 'PROMPT_NOT_REQUIRED',
          consentGrantedAtIso: consent.grantedAtIso,
          phoneVerifiedAtIso: consent.grantedAtIso,
        };
      }

      return { status: 'PROMPT_REQUIRED', reason: 'PHONE_NOT_VERIFIED' };
    }

    if (
      !this.patientContactInputValidator.isSamePhoneNumber(
        profile.primaryPhone,
        whatsappPhone,
      )
    ) {
      return { status: 'PROMPT_REQUIRED', reason: 'PHONE_MISMATCH' };
    }

    if (!consent?.granted) {
      return { status: 'PROMPT_REQUIRED', reason: 'CONSENT_NOT_GRANTED' };
    }

    if (
      !this.patientContactInputValidator.isSamePhoneNumber(
        consent.phone,
        whatsappPhone,
      )
    ) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_PHONE_MISMATCH',
      };
    }

    if (!consent.grantedAtIso) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_TIMESTAMP_MISSING',
      };
    }

    const phoneVerifiedAt = new Date(profile.phoneVerifiedAtIso);
    if (Number.isNaN(phoneVerifiedAt.getTime())) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'INVALID_PHONE_VERIFIED_AT',
      };
    }

    const consentGrantedAt = new Date(consent.grantedAtIso);
    if (Number.isNaN(consentGrantedAt.getTime())) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'INVALID_CONSENT_GRANTED_AT',
      };
    }

    if (consentGrantedAt.getTime() < phoneVerifiedAt.getTime()) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_OUTDATED_AFTER_PHONE_VERIFICATION',
      };
    }

    return {
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: consentGrantedAt.toISOString(),
      phoneVerifiedAtIso: phoneVerifiedAt.toISOString(),
    };
  }

  private normalizePatientId(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }
}
