import { Injectable } from '@nestjs/common';
import {
  APPOINTMENT_REMINDER_SEND_MODES,
  type AppointmentReminderRuntimeSettingsSnapshot,
  type AppointmentReminderSendMode,
} from '../../domain/appointment-reminder-runtime.types';

@Injectable()
export class AppointmentReminderBootstrapConfigService {
  isSyncSchedulerEnabled(): boolean {
    return this.readBooleanEnv('APPOINTMENT_REMINDERS_SYNC_ENABLED', false);
  }

  isDispatchSchedulerEnabled(): boolean {
    return this.readBooleanEnv('APPOINTMENT_REMINDERS_DISPATCH_ENABLED', false);
  }

  isQueueEnabled(): boolean {
    return this.readBooleanEnv('APPOINTMENT_REMINDERS_QUEUE_ENABLED', true);
  }

  getSyncIntervalMs(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_SYNC_INTERVAL_MS',
      300_000,
    );
  }

  getDispatchIntervalMs(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_DISPATCH_INTERVAL_MS',
      60_000,
    );
  }

  getQueueName(): string {
    return (
      (process.env.APPOINTMENT_REMINDERS_QUEUE_NAME ?? '').trim() ||
      'appointment-reminders-dispatch'
    );
  }

  getWhatsAppPhoneNumberId(): string {
    return (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
  }

  getWorkerConcurrency(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_WORKER_CONCURRENCY',
      1,
    );
  }

  getRecoverySweepIntervalMs(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_RECOVERY_SWEEP_INTERVAL_MS',
      300_000,
    );
  }

  getEligibilityLimit(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_ELIGIBILITY_LIMIT',
      500,
    );
  }

  getDispatchBatchSize(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_DISPATCH_BATCH_SIZE',
      50,
    );
  }

  getMaxEligibilityWindowHours(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_ELIGIBILITY_WINDOW_HOURS',
      72,
    );
  }

  getLockTtlSeconds(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_LOCK_TTL_SECONDS',
      300,
    );
  }

  getLockHeartbeatIntervalMs(): number {
    const lockTtlMs = this.getLockTtlSeconds() * 1000;
    const configured = this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_LOCK_HEARTBEAT_INTERVAL_MS',
      60_000,
    );

    return Math.min(configured, lockTtlMs);
  }

  getRecoveryBatchSize(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_RECOVERY_BATCH_SIZE',
      200,
    );
  }

  getVerificationGraceHours(): number {
    return this.readPositiveIntEnv(
      'APPOINTMENT_REMINDERS_MIN_CONFIRMATION_HOURS',
      3,
    );
  }

  getSendMode(): AppointmentReminderSendMode {
    const value = (process.env.APPOINTMENT_REMINDERS_SEND_MODE ?? '')
      .trim()
      .toLowerCase();

    if (value === APPOINTMENT_REMINDER_SEND_MODES.MOCK) {
      return APPOINTMENT_REMINDER_SEND_MODES.MOCK;
    }

    return APPOINTMENT_REMINDER_SEND_MODES.LIVE;
  }

  isMockSendMode(): boolean {
    return this.getSendMode() === APPOINTMENT_REMINDER_SEND_MODES.MOCK;
  }

  getSendRolloutPercent(): number {
    return this.readIntRangeEnv(
      'APPOINTMENT_REMINDERS_SEND_ROLLOUT_PERCENT',
      100,
      0,
      100,
    );
  }

  isWithinReminderSendRollout(patientLegacyUserId: number): boolean {
    const rolloutPercent = this.getSendRolloutPercent();
    if (rolloutPercent >= 100) {
      return true;
    }

    if (rolloutPercent <= 0) {
      return false;
    }

    const cohortBucket = Math.abs(Math.trunc(patientLegacyUserId)) % 100;
    return cohortBucket < rolloutPercent;
  }

  getTimezone(): string {
    const value = (process.env.APPOINTMENT_REMINDERS_TIMEZONE ?? '').trim();
    return value || 'America/Bogota';
  }

  getRuntimeSettingsSnapshot(): AppointmentReminderRuntimeSettingsSnapshot {
    return {
      sendMode: this.getSendMode(),
      sendRolloutPercent:
        this.getSendRolloutPercent() as AppointmentReminderRuntimeSettingsSnapshot['sendRolloutPercent'],
      emergencyPauseEnabled: false,
      dispatchBatchSize:
        this.getDispatchBatchSize() as AppointmentReminderRuntimeSettingsSnapshot['dispatchBatchSize'],
      eligibilityLimit:
        this.getEligibilityLimit() as AppointmentReminderRuntimeSettingsSnapshot['eligibilityLimit'],
      syncEnabled: this.isSyncSchedulerEnabled(),
      dispatchEnabled: this.isDispatchSchedulerEnabled(),
      queueEnabled: this.isQueueEnabled(),
      syncIntervalMs:
        this.getSyncIntervalMs() as AppointmentReminderRuntimeSettingsSnapshot['syncIntervalMs'],
      recoverySweepIntervalMs:
        this.getRecoverySweepIntervalMs() as AppointmentReminderRuntimeSettingsSnapshot['recoverySweepIntervalMs'],
      workerConcurrency:
        this.getWorkerConcurrency() as AppointmentReminderRuntimeSettingsSnapshot['workerConcurrency'],
      lockTtlSeconds:
        this.getLockTtlSeconds() as AppointmentReminderRuntimeSettingsSnapshot['lockTtlSeconds'],
      lockHeartbeatIntervalMs:
        this.getLockHeartbeatIntervalMs() as AppointmentReminderRuntimeSettingsSnapshot['lockHeartbeatIntervalMs'],
      minConfirmationHours:
        this.getVerificationGraceHours() as AppointmentReminderRuntimeSettingsSnapshot['minConfirmationHours'],
    };
  }

  protected readBooleanEnv(key: string, fallback: boolean): boolean {
    const value = (process.env[key] ?? '').trim().toLowerCase();
    if (!value) {
      return fallback;
    }

    return value === 'true';
  }

  protected readPositiveIntEnv(key: string, fallback: number): number {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  protected readIntRangeEnv(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      return fallback;
    }

    return parsed;
  }
}
