export interface PatientValidationRecord {
  patientId: number;
  documentNumber: string;
  birthDateIso: string;
  status: string | null;
  epsCode: string | null;
  userType: string | null;
  sex: string | null;
}

export interface PatientValidationRepository {
  findByDocumentAndBirthDate(
    documentNumber: string,
    birthDateIso: string,
  ): Promise<PatientValidationRecord | null>;
}
