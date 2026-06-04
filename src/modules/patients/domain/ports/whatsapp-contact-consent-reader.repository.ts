import type {
  WhatsappContactConsentChannel,
  WhatsappContactConsentPurpose,
} from './whatsapp-contact-consent.repository';

export interface WhatsappContactConsentSnapshot {
  patientLegacyUserId: number;
  phone: string;
  channel: WhatsappContactConsentChannel;
  purpose: WhatsappContactConsentPurpose;
  granted: boolean;
  grantedAtIso: string | null;
  revokedAtIso: string | null;
}

export interface WhatsappContactConsentReaderRepository {
  findConsentByPatientAndPurpose(input: {
    patientLegacyUserId: number;
    channel: WhatsappContactConsentChannel;
    purpose: WhatsappContactConsentPurpose;
  }): Promise<WhatsappContactConsentSnapshot | null>;
}
