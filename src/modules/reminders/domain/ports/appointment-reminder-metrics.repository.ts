export interface AppointmentReminderOperationalMetricsSnapshot {
  generatedAtIso: string;
  lookbackHours: number;
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

export interface AppointmentReminderMetricsRepository {
  getOperationalSnapshot(input: {
    runAtIso: string;
    lookbackHours: number;
  }): Promise<AppointmentReminderOperationalMetricsSnapshot>;
}
