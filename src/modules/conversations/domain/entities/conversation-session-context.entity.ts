export interface PatientValidationSessionContext {
  failedAttempts: number;
  documentNumber?: string;
  documentNumberMasked?: string;
  patientId?: number;
  epsCode?: string;
  userType?: string;
  sex?: 'H' | 'M';
}

export type ConversationFlowIntent =
  | 'REQUEST_APPOINTMENT'
  | 'CANCEL_OR_RESCHEDULE'
  | 'CHECK_APPOINTMENTS'
  | 'CHECK_DISPENSARY';

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

export interface OfferedAssignedAppointmentSessionContext {
  slotRef: string;
  specialtyName: string;
  specialtyCups?: string;
  professionalName: string;
  siteName: string;
  siteAddress: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  appointmentDisplayTime: string;
}

export interface AssignedAppointmentSelectionSessionContext {
  patientFullName: string;
  currentOffset: number;
  hasMoreAppointments: boolean;
  nextOffset?: number;
  offeredAppointments: OfferedAssignedAppointmentSessionContext[];
  selectedAppointment?: OfferedAssignedAppointmentSessionContext;
}

export interface AppointmentRescheduleSessionContext {
  originalSlotRef: string;
  originalSpecialtyName: string;
  originalSpecialtyCups: string;
  originalAppointmentDateIso: string;
  originalAppointmentTimeHHmm: string;
}

export interface ConversationSessionContext {
  flowIntent?: ConversationFlowIntent;
  patientValidation?: PatientValidationSessionContext;
  assignedAppointmentSelection?: AssignedAppointmentSelectionSessionContext;
  appointmentReschedule?: AppointmentRescheduleSessionContext;
  specialtySelection?: SpecialtySelectionSessionContext;
  appointmentDoctorSelection?: AppointmentDoctorSelectionSessionContext;
  appointmentDateSelection?: AppointmentDateSelectionSessionContext;
  appointmentTimeSelection?: AppointmentTimeSelectionSessionContext;
}
