import type { PatientSexCode } from '../../../../shared/domain/patient-sex-code';

export interface PatientValidationSessionContext {
  failedAttempts: number;
  documentNumber?: string;
  documentNumberMasked?: string;
  patientId?: number;
  epsCode?: string;
  userType?: string;
  sex?: PatientSexCode;
}

export type ConversationFlowIntent =
  | 'REQUEST_APPOINTMENT'
  | 'CANCEL_OR_RESCHEDULE'
  | 'CHECK_APPOINTMENTS'
  | 'CHECK_DISPENSARY'
  | 'UPDATE_CONTACT';

export type ContactUpdateMode = 'PHONE' | 'EMAIL' | 'BOTH';

export interface ContactVerificationSessionContext {
  fullName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  requiresPhoneUpdate: boolean;
  requiresEmailUpdate: boolean;
  selectedUpdateMode?: ContactUpdateMode;
  pendingPhone?: string;
  verifiedPhone?: string;
  completedForCurrentFlow: boolean;
  invalidPhoneAttempts: number;
  invalidEmailAttempts: number;
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

export const INTERACTIVE_PROMPT_SOURCES = {
  ORIGINAL: 'ORIGINAL',
  IDLE_REMINDER_REISSUE: 'IDLE_REMINDER_REISSUE',
} as const;

export type InteractivePromptSource =
  (typeof INTERACTIVE_PROMPT_SOURCES)[keyof typeof INTERACTIVE_PROMPT_SOURCES];

export interface InteractivePromptWindowItem {
  promptId: string;
  logicalStepKey: string;
  promptKind: string;
  state: string;
  outboundMessageId: string;
  allowedReplyIds: string[];
  issuedAt: string;
  source: InteractivePromptSource;
  validUntil?: string;
}

export interface InteractivePromptWindow {
  currentPromptId: string;
  prompts: InteractivePromptWindowItem[];
}

export interface ConversationSessionContext {
  flowIntent?: ConversationFlowIntent;
  patientValidation?: PatientValidationSessionContext;
  contactVerification?: ContactVerificationSessionContext;
  appointmentNotificationsConsentPhone?: string;
  assignedAppointmentSelection?: AssignedAppointmentSelectionSessionContext;
  appointmentReschedule?: AppointmentRescheduleSessionContext;
  specialtySelection?: SpecialtySelectionSessionContext;
  appointmentDoctorSelection?: AppointmentDoctorSelectionSessionContext;
  appointmentDateSelection?: AppointmentDateSelectionSessionContext;
  appointmentTimeSelection?: AppointmentTimeSelectionSessionContext;
  interactivePromptWindow?: InteractivePromptWindow;
}
