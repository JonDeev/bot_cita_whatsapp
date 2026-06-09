export interface MarkPatientPhoneVerifiedCommand {
  patientId: number;
  verifiedAtIso?: string;
}

export type MarkPatientPhoneVerifiedPersistenceResult =
  | 'UPDATED'
  | 'PATIENT_NOT_FOUND'
  | 'WRITE_DISABLED';

export interface MarkPatientPhoneVerifiedRepository {
  markPatientPhoneVerified(
    command: MarkPatientPhoneVerifiedCommand,
  ): Promise<MarkPatientPhoneVerifiedPersistenceResult>;
}
