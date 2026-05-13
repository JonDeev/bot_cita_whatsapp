export interface AssignedDispensaryRecord {
  patientId: number;
  firstName: string;
  secondName: string | null;
  firstLastName: string;
  secondLastName: string | null;
  dispensaryId: number;
  dispensaryName: string;
  dispensaryAddress: string;
  dispensaryCity: string;
  dispensarySchedule: string;
}

export interface PatientAssignedDispensaryRepository {
  findAssignedDispensaryByPatientId(
    patientId: number,
  ): Promise<AssignedDispensaryRecord | null>;

  findPatientFullNameById(patientId: number): Promise<string | null>;
}
