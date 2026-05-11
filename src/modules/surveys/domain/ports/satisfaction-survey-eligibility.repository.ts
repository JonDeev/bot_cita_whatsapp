export interface SatisfactionSurveyEligibleAppointment {
  legacyAgendaId: number;
  patientLegacyUserId: number;
  patientName: string;
  patientPhone: string | null;
  appointmentDateIso: string;
  appointmentTimeHhmm: string;
  specialtyName: string | null;
  doctorName: string | null;
  siteName: string | null;
}

export interface FindEligibleAppointmentsByWindowFilters {
  surveyDateIso: string;
  windowStartHHmm: string;
  windowEndHHmm: string;
}

export interface SatisfactionSurveyEligibilityRepository {
  findEligibleAppointmentsByWindow(
    filters: FindEligibleAppointmentsByWindowFilters,
  ): Promise<SatisfactionSurveyEligibleAppointment[]>;
}
