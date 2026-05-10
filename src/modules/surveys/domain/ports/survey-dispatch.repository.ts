export const SATISFACTION_SURVEY_DISPATCH_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED_BY_HANDOFF: 'CANCELLED_BY_HANDOFF',
  BLOCKED_CONTACT: 'BLOCKED_CONTACT',
} as const;

export type SatisfactionSurveyDispatchStatus =
  (typeof SATISFACTION_SURVEY_DISPATCH_STATUSES)[keyof typeof SATISFACTION_SURVEY_DISPATCH_STATUSES];

export interface SurveyDispatchAppointmentSnapshot {
  legacyAgendaId: number;
  appointmentDateIso: string;
  appointmentTimeHhmm: string;
  specialtyName?: string | null;
  doctorName?: string | null;
  siteName?: string | null;
}

export interface SatisfactionSurveyDispatchRecord {
  id: number;
  patientLegacyUserId: number;
  patientName: string;
  patientPhone: string;
  patientPhoneE164: string | null;
  surveyDateIso: string;
  status: SatisfactionSurveyDispatchStatus;
  dedupeKey: string;
  expiresAtIso: string;
  conversationKey: string | null;
  initialTemplateName: string | null;
  initialTemplateLanguage: string | null;
  flowToken: string | null;
  appointments: readonly SurveyDispatchAppointmentSnapshot[];
}

export interface CreateSurveyDispatchCommand {
  surveyDefinitionCode: string;
  surveyDefinitionVersion: number;
  patientLegacyUserId: number;
  patientName: string;
  patientPhone: string;
  patientPhoneE164: string | null;
  surveyDateIso: string;
  triggerType: string;
  windowStartIso: string;
  windowEndIso: string;
  expiresAtIso: string;
  dedupeKey: string;
  appointments: readonly SurveyDispatchAppointmentSnapshot[];
}

export interface CreateSurveyDispatchResult {
  dispatch: SatisfactionSurveyDispatchRecord;
  wasCreated: boolean;
}

export interface MarkSurveyDispatchSentCommand {
  dispatchId: number;
  conversationKey: string;
  initialTemplateName: string;
  initialTemplateLanguage: string;
  initialWhatsappMessageId: string;
  flowToken: string;
}

export interface MarkSurveyDispatchFailedCommand {
  dispatchId: number;
  failedAtIso: string;
  failureReason: string;
}

export interface MarkSurveyDispatchCancelledByHandoffCommand {
  dispatchId: number;
  cancellationReason: string;
}

export interface SurveyDispatchRepository {
  createOrGetDailyDispatch(
    command: CreateSurveyDispatchCommand,
  ): Promise<CreateSurveyDispatchResult>;
  findById(dispatchId: number): Promise<SatisfactionSurveyDispatchRecord | null>;
  markSent(command: MarkSurveyDispatchSentCommand): Promise<void>;
  markFailed(command: MarkSurveyDispatchFailedCommand): Promise<void>;
  markCancelledByHandoff(
    command: MarkSurveyDispatchCancelledByHandoffCommand,
  ): Promise<void>;
}
