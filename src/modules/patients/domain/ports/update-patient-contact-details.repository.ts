export type PatientContactUpdateMode = 'PHONE' | 'EMAIL' | 'BOTH';

export interface UpdatePatientContactDetailsCommand {
  patientId: number;
  mode: PatientContactUpdateMode;
  nextPrimaryPhone?: string;
  phoneBackupToSecondary?: string;
  nextPrimaryEmail?: string;
  emailBackupToSecondary?: string;
}

export type UpdatePatientContactDetailsPersistenceResult =
  | 'UPDATED'
  | 'PATIENT_NOT_FOUND'
  | 'WRITE_DISABLED';

export interface UpdatePatientContactDetailsRepository {
  updatePatientContactDetails(
    command: UpdatePatientContactDetailsCommand,
  ): Promise<UpdatePatientContactDetailsPersistenceResult>;
}
