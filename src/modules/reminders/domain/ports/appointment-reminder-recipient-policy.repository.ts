export interface AppointmentReminderRecipientPolicyRepository {
  hasAppointmentNotificationsOptIn(input: {
    patientLegacyUserId: number;
  }): Promise<boolean>;
  hasActiveSuppression(input: {
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
