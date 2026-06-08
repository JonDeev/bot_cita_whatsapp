import type { AppointmentReminderDispatchStatus } from '../appointment-reminder-dispatch-status';

export interface AppointmentReminderDispatchRecord {
  id: number;
  legacyAgendaId: number;
  patientLegacyUserId: number;
  conversationKey: string | null;
  recipientPhoneRaw: string;
  recipientPhoneE164: string | null;
  appointmentStartsAtIso: string;
  scheduledForIso: string;
  reminderType: string;
  status: AppointmentReminderDispatchStatus;
  templateName: string;
  verificationTemplateName: string;
  metaMessageId: string | null;
  verificationMessageId: string | null;
  attempts: number;
  nextAttemptAtIso: string | null;
  lockAcquiredAtIso: string | null;
  lockExpiresAtIso: string | null;
  lockedBy: string | null;
  lockVersion: number;
  verificationTokenHash: string | null;
  verificationRequestedAtIso: string | null;
  verificationExpiresAtIso: string | null;
  sentAtIso: string | null;
}

export interface UpsertAppointmentReminderDispatchCommand {
  legacyAgendaId: number;
  patientLegacyUserId: number;
  conversationKey: string | null;
  recipientPhoneRaw: string;
  recipientPhoneE164: string | null;
  appointmentStartsAtIso: string;
  scheduledForIso: string;
  reminderType: string;
  templateName: string;
  verificationTemplateName: string;
}

export interface ClaimDueAppointmentReminderDispatchesCommand {
  runAtIso: string;
  workerId: string;
  lockTtlSeconds: number;
  limit: number;
  restrictToDispatchIds?: readonly number[];
}

export interface MarkDispatchVerificationPendingCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  verificationTokenHash: string;
  verificationMessageId: string;
  verificationRequestedAtIso: string;
  verificationExpiresAtIso: string;
}

export interface MarkDispatchSentCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  metaMessageId: string;
  sentAtIso: string;
}

export interface MarkDispatchSkippedCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  status:
    | 'SKIPPED_NO_OPT_IN'
    | 'SKIPPED_INVALID_PHONE'
    | 'SKIPPED_APPOINTMENT_CANCELLED'
    | 'SKIPPED_APPOINTMENT_RESCHEDULED'
    | 'SKIPPED_LATE_CONFIRMATION'
    | 'SKIPPED_SUPPRESSED_CONTACT'
    | 'SKIPPED_HANDOFF_ACTIVE'
    | 'PHONE_VERIFICATION_EXPIRED';
  reason?: string;
}

export interface MarkDispatchFailedCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  reason: string;
  nextAttemptAtIso: string | null;
  attempts: number;
}

export interface MarkDispatchPausedHoldCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  reason: string;
}

export interface RenewDispatchLockCommand {
  dispatchId: number;
  expectedLockVersion: number;
  workerId: string;
  nowIso: string;
  lockTtlSeconds: number;
}

export interface RecordInboundDedupCommand {
  provider: string;
  inboundMessageId: string;
  buttonPayloadId: string;
  receivedAtIso: string;
  resultStatus: string;
}

export interface AppointmentReminderDispatchRepository {
  upsertDispatch(command: UpsertAppointmentReminderDispatchCommand): Promise<{
    dispatch: AppointmentReminderDispatchRecord;
    wasCreated: boolean;
  }>;
  markOlderPendingDispatchesAsRescheduled(input: {
    legacyAgendaId: number;
    keepDispatchId: number;
  }): Promise<number>;
  claimDueDispatches(
    command: ClaimDueAppointmentReminderDispatchesCommand,
  ): Promise<AppointmentReminderDispatchRecord[]>;
  findDueDispatchIds(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number[]>;
  renewLock(command: RenewDispatchLockCommand): Promise<boolean>;
  recoverExpiredLocks(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number>;
  expirePendingPhoneVerifications(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number>;
  markVerificationPending(
    command: MarkDispatchVerificationPendingCommand,
  ): Promise<boolean>;
  markVerificationPendingAfterUncertainOwnership(input: {
    dispatchId: number;
    verificationTokenHash: string;
    verificationMessageId: string;
    verificationRequestedAtIso: string;
    verificationExpiresAtIso: string;
  }): Promise<boolean>;
  markSent(command: MarkDispatchSentCommand): Promise<boolean>;
  markSentAfterUncertainOwnership(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean>;
  markSkipped(command: MarkDispatchSkippedCommand): Promise<boolean>;
  markFailed(command: MarkDispatchFailedCommand): Promise<boolean>;
  markPausedHold(command: MarkDispatchPausedHoldCommand): Promise<boolean>;
  markPostVerificationSent(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean>;
  markPostVerificationPausedHold(input: {
    dispatchId: number;
    reason?: string;
  }): Promise<boolean>;
  markPostVerificationSentAfterUncertainOwnership(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean>;
  markPostVerificationSkipped(input: {
    dispatchId: number;
    status:
      | 'SKIPPED_LATE_CONFIRMATION'
      | 'SKIPPED_SUPPRESSED_CONTACT'
      | 'SKIPPED_APPOINTMENT_CANCELLED'
      | 'SKIPPED_HANDOFF_ACTIVE'
      | 'SKIPPED_NO_OPT_IN';
    reason?: string;
  }): Promise<boolean>;
  findById(
    dispatchId: number,
  ): Promise<AppointmentReminderDispatchRecord | null>;
  findByVerificationTokenHash(
    verificationTokenHash: string,
  ): Promise<AppointmentReminderDispatchRecord | null>;
  recordInboundDedup(command: RecordInboundDedupCommand): Promise<boolean>;
  markInboundDedupProcessed(input: {
    provider: string;
    inboundMessageId: string;
    buttonPayloadId: string;
    processedAtIso: string;
    resultStatus: string;
  }): Promise<void>;
  releasePausedHolds(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number[]>;
}
