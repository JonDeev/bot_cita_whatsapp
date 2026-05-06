export interface FindAvailableAppointmentDatesFilters {
  specialtyCups: string;
  cutoffDateIso: string;
  cutoffTimeHHmm: string;
}

export interface AvailableAppointmentDateCandidate {
  dateIso: string;
}

export interface FindAvailableAppointmentTimesByDateFilters {
  specialtyCups: string;
  dateIso: string;
  minimumTimeHHmm: string;
  afterTimeHHmmExclusive?: string;
  maxResults: number;
}

export interface AvailableAppointmentTimeCandidate {
  slotRef: string;
  timeHHmm: string;
}

export interface AppointmentAvailabilityRepository {
  findAvailableDates(
    filters: FindAvailableAppointmentDatesFilters,
  ): Promise<AvailableAppointmentDateCandidate[]>;

  findAvailableTimesByDate(
    filters: FindAvailableAppointmentTimesByDateFilters,
  ): Promise<AvailableAppointmentTimeCandidate[]>;
}
