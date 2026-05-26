export type AppointmentReminderPatientContactWriteResult =
  | 'UPDATED'
  | 'PATIENT_NOT_FOUND'
  | 'WRITE_DISABLED';

export interface AppointmentReminderPatientContactRepository {
  markPhoneVerified(input: {
    patientLegacyUserId: number;
    verifiedAtIso: string;
  }): Promise<AppointmentReminderPatientContactWriteResult>;
  clearPhoneAndVerification(input: {
    patientLegacyUserId: number;
  }): Promise<AppointmentReminderPatientContactWriteResult>;
}
