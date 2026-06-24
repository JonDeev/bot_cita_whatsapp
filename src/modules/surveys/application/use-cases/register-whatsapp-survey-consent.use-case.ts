import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONTACT_CONSENT_REPOSITORY } from '../../../patients/domain/patients.tokens';
import type { WhatsappContactConsentRepository } from '../../../patients/domain/ports/whatsapp-contact-consent.repository';
import {
  WHATSAPP_CONTACT_CONSENT_CHANNEL,
  WHATSAPP_CONTACT_CONSENT_PURPOSES,
} from '../../../patients/domain/ports/whatsapp-contact-consent.repository';

export interface RegisterWhatsappSurveyConsentInput {
  patientId: number | null | undefined;
  phone: string | null | undefined;
  granted: boolean;
  consentTextSnapshot: string;
  policyUrl?: string | null;
  policyVersion?: string | null;
  source?: string;
  respondedAtIso?: string;
}

export type RegisterWhatsappSurveyConsentResult =
  | { status: 'RECORDED' }
  | {
      status: 'SKIPPED';
      reason: 'INVALID_PATIENT_ID' | 'INVALID_PHONE' | 'MISSING_CONSENT_TEXT';
    };

@Injectable()
export class RegisterWhatsappSurveyConsentUseCase {
  private static readonly DEFAULT_SOURCE =
    'SURVEY_PHONE_VERIFICATION_TEMPLATE';

  constructor(
    @Inject(WHATSAPP_CONTACT_CONSENT_REPOSITORY)
    private readonly whatsappContactConsentRepository: WhatsappContactConsentRepository,
  ) {}

  async execute(
    input: RegisterWhatsappSurveyConsentInput,
  ): Promise<RegisterWhatsappSurveyConsentResult> {
    const patientId = this.normalizePatientId(input.patientId);
    if (patientId === null) {
      return {
        status: 'SKIPPED',
        reason: 'INVALID_PATIENT_ID',
      };
    }

    const phone = this.normalizePhone(input.phone);
    if (!phone) {
      return {
        status: 'SKIPPED',
        reason: 'INVALID_PHONE',
      };
    }

    const consentTextSnapshot = input.consentTextSnapshot?.trim();
    if (!consentTextSnapshot) {
      return {
        status: 'SKIPPED',
        reason: 'MISSING_CONSENT_TEXT',
      };
    }

    const respondedAtIso = this.normalizeRespondedAtIso(input.respondedAtIso);

    await this.whatsappContactConsentRepository.recordConsent({
      patientLegacyUserId: patientId,
      phone,
      channel: WHATSAPP_CONTACT_CONSENT_CHANNEL,
      source:
        input.source?.trim() ||
        RegisterWhatsappSurveyConsentUseCase.DEFAULT_SOURCE,
      consentTextSnapshot,
      policyUrl: input.policyUrl?.trim() || null,
      policyVersion: input.policyVersion?.trim() || null,
      response: input.granted ? 'ACCEPTED' : 'DECLINED',
      respondedAtIso,
      purposes: [WHATSAPP_CONTACT_CONSENT_PURPOSES.SATISFACTION_SURVEYS],
    });

    return { status: 'RECORDED' };
  }

  private normalizePatientId(value: number | null | undefined): number | null {
    if (!Number.isInteger(value) || (value ?? 0) <= 0) {
      return null;
    }

    return value as number;
  }

  private normalizePhone(value: string | null | undefined): string | null {
    const digits = (value ?? '').replace(/\D+/g, '').trim();
    return digits.length > 0 ? digits : null;
  }

  private normalizeRespondedAtIso(value: string | undefined): string {
    if (!value) {
      return new Date().toISOString();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }

    return parsed.toISOString();
  }
}
