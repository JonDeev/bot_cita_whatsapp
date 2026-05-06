export interface FindAvailableAppointmentDatesFilters {
  specialtyCups: string;
  cutoffDateIso: string;
  cutoffTimeHHmm: string;
  doctorEmployeeCode?: string;
}

export interface AvailableAppointmentDateCandidate {
  dateIso: string;
}

export interface FindAvailableAppointmentDoctorsFilters {
  specialtyCups: string;
  cutoffDateIso: string;
  cutoffTimeHHmm: string;
  maxResults: number;
}

export interface AvailableAppointmentDoctorCandidate {
  employeeCode: string;
  professionalName: string;
}

export interface FindAvailableAppointmentTimesByDateFilters {
  specialtyCups: string;
  dateIso: string;
  minimumTimeHHmm: string;
  afterTimeHHmmExclusive?: string;
  doctorEmployeeCode?: string;
  maxResults: number;
}

export interface AvailableAppointmentTimeCandidate {
  slotRef: string;
  timeHHmm: string;
}

export interface AppointmentAvailabilityRepository {
  findAvailableDoctors(
    filters: FindAvailableAppointmentDoctorsFilters,
  ): Promise<AvailableAppointmentDoctorCandidate[]>;

  findAvailableDates(
    filters: FindAvailableAppointmentDatesFilters,
  ): Promise<AvailableAppointmentDateCandidate[]>;

  findAvailableTimesByDate(
    filters: FindAvailableAppointmentTimesByDateFilters,
  ): Promise<AvailableAppointmentTimeCandidate[]>;
}
