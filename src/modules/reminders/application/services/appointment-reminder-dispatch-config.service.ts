import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderDispatchConfigService {
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

  getTimezone(): string {
    const value = (process.env.APPOINTMENT_REMINDERS_TIMEZONE ?? '').trim();
    return value || 'America/Bogota';
  }

  private readBooleanEnv(key: string, fallback: boolean): boolean {
    const value = (process.env[key] ?? '').trim().toLowerCase();
    if (!value) {
      return fallback;
    }

    return value === 'true';
  }

  private readPositiveIntEnv(key: string, fallback: number): number {
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
}
