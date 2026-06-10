export type AppointmentReminderContactSuppressionReason =
  | 'UNKNOWN_PERSON'
  | 'MANUAL_BLOCK';

export type AppointmentReminderContactSuppressionDecision =
  | {
      kind: 'ALLOW_CONTACT';
    }
  | {
      kind: 'BLOCK_INVALID_PHONE';
    }
  | {
      kind: 'BLOCK_SUPPRESSED_CONTACT';
      reason: AppointmentReminderContactSuppressionReason;
    };

export interface AppointmentReminderRecipientPolicyRepository {
  hasAppointmentNotificationsOptIn(input: {
    patientLegacyUserId: number;
  }): Promise<boolean>;
  resolveReminderContactSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<AppointmentReminderContactSuppressionDecision>;
  hasActiveSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean>;
  clearUnknownPersonSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean>;
  isHumanHandoffActive(input: {
    conversationKey: string | null;
  }): Promise<boolean>;
  upsertUnknownPersonSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
    notes?: string;
  }): Promise<void>;
}
