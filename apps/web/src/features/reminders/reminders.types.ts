export interface AppointmentReminderMetrics {
  generatedAtIso: string;
  lookbackHours: number;
  timezone: 'America/Bogota';
  backlog: {
    dueDispatches: number;
    oldestDueScheduledForIso: string | null;
    maxLagSeconds: number;
  };
  states: {
    pending: number;
    locked: number;
    phoneVerificationPending: number;
    phoneVerificationExpired: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  recent: {
    created: number;
    sent: number;
    failed: number;
    skipped: number;
    verificationRequested: number;
    sendLatencySecondsAvg: number;
    sendLatencySecondsP95Approx: number;
  };
  reliability: {
    duplicateInboundIgnoredEvents: number;
    lockRecoveredEvents: number;
    lockLostEvents: number;
  };
}

export interface AdminReminderDispatchItem {
  id: number;
  legacyAgendaId: number;
  patientLegacyUserId: number;
  recipientPhoneMasked: string;
  reminderType: string;
  status: string;
  attempts: number;
  scheduledForIso: string;
  sentAtIso: string | null;
  updatedAtIso: string;
  lastError: string | null;
}

export interface PaginatedReminderDispatches {
  items: AdminReminderDispatchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReminderDispatchesParams {
  page?: number;
  pageSize?: number;
  status?: string;
  from?: string;
  to?: string;
}
