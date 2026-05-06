export interface FindNearestPendingFutureAppointmentFilters {
  patientUserId: string;
  specialtyCups: string;
  currentDateIso: string;
  currentTimeHHmm: string;
}

export interface PendingFutureAppointmentCandidate {
  slotRef: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  modalityId: number | null;
  professionalName: string | null;
  siteName: string | null;
  siteAddress: string | null;
  patientFirstName: string | null;
  patientSecondName: string | null;
  patientFirstLastName: string | null;
  patientSecondLastName: string | null;
}

export interface PendingAppointmentCheckRepository {
  findNearestPendingFutureAppointmentByPatientAndSpecialty(
    filters: FindNearestPendingFutureAppointmentFilters,
  ): Promise<PendingFutureAppointmentCandidate | null>;
}
