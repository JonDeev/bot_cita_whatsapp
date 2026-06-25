export interface MarkPatientEmailVerifiedCommand {
  patientId: number;
  verifiedAtIso?: string;
}

export type MarkPatientEmailVerifiedPersistenceResult =
  | 'UPDATED'
  | 'PATIENT_NOT_FOUND'
  | 'WRITE_DISABLED';

export interface MarkPatientEmailVerifiedRepository {
  markPatientEmailVerified(
    command: MarkPatientEmailVerifiedCommand,
  ): Promise<MarkPatientEmailVerifiedPersistenceResult>;
}
