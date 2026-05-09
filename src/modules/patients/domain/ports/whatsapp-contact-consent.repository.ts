export const WHATSAPP_CONTACT_CONSENT_CHANNEL = 'WHATSAPP' as const;
export type WhatsappContactConsentChannel =
  typeof WHATSAPP_CONTACT_CONSENT_CHANNEL;

export const WHATSAPP_CONTACT_CONSENT_PURPOSES = {
  APPOINTMENT_NOTIFICATIONS: 'APPOINTMENT_NOTIFICATIONS',
  SATISFACTION_SURVEYS: 'SATISFACTION_SURVEYS',
} as const;

export type WhatsappContactConsentPurpose =
  (typeof WHATSAPP_CONTACT_CONSENT_PURPOSES)[keyof typeof WHATSAPP_CONTACT_CONSENT_PURPOSES];

export type WhatsappContactConsentResponse = 'ACCEPTED' | 'DECLINED';

export interface RecordWhatsappContactConsentCommand {
  patientLegacyUserId: number;
  phone: string;
  channel: WhatsappContactConsentChannel;
  source: string;
  consentTextSnapshot: string;
  policyUrl?: string | null;
  policyVersion?: string | null;
  response: WhatsappContactConsentResponse;
  respondedAtIso: string;
  purposes: WhatsappContactConsentPurpose[];
}

export interface WhatsappContactConsentRepository {
  recordConsent(command: RecordWhatsappContactConsentCommand): Promise<void>;
}
