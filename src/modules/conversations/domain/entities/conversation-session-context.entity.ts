export interface PatientValidationSessionContext {
  failedAttempts: number;
  documentNumber?: string;
  documentNumberMasked?: string;
  patientId?: number;
  epsCode?: string;
  userType?: string;
  sex?: 'H' | 'M';
}

export interface OfferedSpecialtySessionContext {
  code: string;
  name: string;
  cups?: string;
}

export interface SpecialtySelectionSessionContext {
  offeredSpecialties: OfferedSpecialtySessionContext[];
  selectedSpecialty?: OfferedSpecialtySessionContext;
}

export interface OfferedAppointmentDateSessionContext {
  isoDate: string;
  displayDate: string;
}

export interface AppointmentDateSelectionSessionContext {
  scope: 'SPECIALTY' | 'DOCTOR';
  specialtyOfferedDates: OfferedAppointmentDateSessionContext[];
  offeredDates: OfferedAppointmentDateSessionContext[];
  selectedDateIso?: string;
}

export interface OfferedAppointmentDoctorSessionContext {
  employeeCode: string;
  displayName: string;
}

export interface AppointmentDoctorSelectionSessionContext {
  offeredDoctors: OfferedAppointmentDoctorSessionContext[];
  selectedDoctor?: OfferedAppointmentDoctorSessionContext;
}

export interface OfferedAppointmentTimeSessionContext {
  slotRef: string;
  timeHHmm: string;
  displayTime: string;
}

export interface AppointmentTimeSelectionSessionContext {
  offeredTimes: OfferedAppointmentTimeSessionContext[];
  hasMoreTimes: boolean;
  nextCursorTimeHHmm?: string;
  selectedSlotRef?: string;
  selectedTimeHHmm?: string;
}

export interface ConversationSessionContext {
  patientValidation?: PatientValidationSessionContext;
  specialtySelection?: SpecialtySelectionSessionContext;
  appointmentDoctorSelection?: AppointmentDoctorSelectionSessionContext;
  appointmentDateSelection?: AppointmentDateSelectionSessionContext;
  appointmentTimeSelection?: AppointmentTimeSelectionSessionContext;
}
