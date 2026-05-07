export interface FindFutureAssignedAppointmentsByPatientFilters {
  patientUserId: string;
  currentDateIso: string;
  currentTimeHHmm: string;
  offset: number;
  maxResults: number;
}

export interface FutureAssignedAppointmentCandidate {
  slotRef: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  specialtyName: string | null;
  specialtyCups: string | null;
  professionalName: string | null;
}

export interface PatientAssignedAppointmentRepository {
  findFutureAssignedAppointmentsByPatient(
    filters: FindFutureAssignedAppointmentsByPatientFilters,
  ): Promise<FutureAssignedAppointmentCandidate[]>;
}
