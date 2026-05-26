export interface EligibleAppointmentForReminder {
  legacyAgendaId: number;
  patientLegacyUserId: number;
  patientPhoneRaw: string | null;
  patientFirstName: string;
  patientLastName: string;
  patientPhoneVerifiedAtIso: string | null;
  appointmentDateIso: string;
  appointmentTimeHhmm: string;
  legacyState: string | null;
  modalityId: number;
  specialtyName: string | null;
  doctorName: string | null;
  siteCity: string | null;
  siteAddress: string | null;
}

export interface AppointmentReminderEligibilityRepository {
  findFutureAssignedAppointments(input: {
    nowIso: string;
    maxWindowHours: number;
    limit: number;
  }): Promise<EligibleAppointmentForReminder[]>;
  findByLegacyAgendaIds(
    legacyAgendaIds: readonly number[],
  ): Promise<EligibleAppointmentForReminder[]>;
}
