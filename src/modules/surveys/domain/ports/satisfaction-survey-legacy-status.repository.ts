export const SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES = {
  NOT_SENT: 'No enviado',
  SENT: 'Enviado',
  ANSWERED: 'Respondida',
  NOT_APPLICABLE: 'No aplica',
} as const;

export type SatisfactionSurveyLegacyNotificationStatus =
  (typeof SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES)[keyof typeof SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES];

export interface UpdateAgendaSurveyNotificationStatusCommand {
  legacyAgendaIds: readonly number[];
  status: SatisfactionSurveyLegacyNotificationStatus;
}

export interface SatisfactionSurveyLegacyStatusRepository {
  updateAgendaSurveyNotificationStatus(
    command: UpdateAgendaSurveyNotificationStatusCommand,
  ): Promise<number>;
}
