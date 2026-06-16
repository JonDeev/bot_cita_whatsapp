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

export type ResolvePostBookingWhatsappAppointmentNotificationsOptInGateResult =
  | {
      status: 'PROMPT_REQUIRED';
      reason:
        | 'INVALID_PATIENT_ID'
        | 'PATIENT_NOT_FOUND'
        | 'INVALID_PRIMARY_PHONE'
        | 'CONSENT_NOT_GRANTED'
        | 'CONSENT_PHONE_MISMATCH'
        | 'CONSENT_TIMESTAMP_MISSING'
        | 'INVALID_CONSENT_GRANTED_AT';
      officialPhone: string | null;
    }
  | {
      status: 'PROMPT_NOT_REQUIRED';
      consentGrantedAtIso: string;
      officialPhone: string;
    };

@Injectable()
export class ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    @Inject(WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY)
    private readonly whatsappContactConsentReaderRepository: WhatsappContactConsentReaderRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(input: {
    patientId: number | null | undefined;
  }): Promise<ResolvePostBookingWhatsappAppointmentNotificationsOptInGateResult> {
    const patientId = this.normalizePatientId(input.patientId);
    if (patientId === null) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'INVALID_PATIENT_ID',
        officialPhone: null,
      };
    }

    const profile = await this.patientContactProfileRepository.findByPatientId(
      patientId,
    );
    if (!profile) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'PATIENT_NOT_FOUND',
        officialPhone: null,
      };
    }

    const officialPhone = this.patientContactInputValidator.normalizePhone(
      profile.primaryPhone,
    );
    if (!officialPhone) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'INVALID_PRIMARY_PHONE',
        officialPhone: null,
      };
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

    if (!consent?.granted) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_NOT_GRANTED',
        officialPhone,
      };
    }

    if (
      !this.patientContactInputValidator.isSamePhoneNumber(
        consent.phone,
        officialPhone,
      )
    ) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_PHONE_MISMATCH',
        officialPhone,
      };
    }

    if (!consent.grantedAtIso) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'CONSENT_TIMESTAMP_MISSING',
        officialPhone,
      };
    }

    const consentGrantedAt = new Date(consent.grantedAtIso);
    if (Number.isNaN(consentGrantedAt.getTime())) {
      return {
        status: 'PROMPT_REQUIRED',
        reason: 'INVALID_CONSENT_GRANTED_AT',
        officialPhone,
      };
    }

    return {
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: consentGrantedAt.toISOString(),
      officialPhone,
    };
  }

  private normalizePatientId(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }
}
