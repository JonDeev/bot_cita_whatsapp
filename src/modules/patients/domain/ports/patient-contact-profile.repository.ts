export interface PatientContactProfileRecord {
  patientId: number;
  firstName: string;
  secondName: string | null;
  firstLastName: string;
  secondLastName: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  phoneVerifiedAtIso: string | null;
  emailVerifiedAtIso: string | null;
}

export interface PatientContactProfileRepository {
  findByPatientId(
    patientId: number,
  ): Promise<PatientContactProfileRecord | null>;
}
