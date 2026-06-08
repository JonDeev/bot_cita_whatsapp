import { z } from 'zod';
import {
  APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES,
  APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS,
  APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES,
  APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES,
  APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES,
  APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS,
  APPOINTMENT_REMINDER_SEND_MODES,
  APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS,
  APPOINTMENT_REMINDER_SYNC_INTERVALS_MS,
  APPOINTMENT_REMINDER_WORKER_CONCURRENCIES,
} from '../../../reminders/domain/appointment-reminder-runtime.types';

const reminderSendModeValues = [
  APPOINTMENT_REMINDER_SEND_MODES.MOCK,
  APPOINTMENT_REMINDER_SEND_MODES.LIVE,
] as const;

const reminderBooleanSelectValues = ['enabled', 'disabled'] as const;

function numberValuesToStringEnum<TValues extends readonly number[]>(
  values: TValues,
) {
  return values.map(String) as [`${TValues[number]}`, ...`${TValues[number]}`[]];
}

const reminderRuntimeSettingsSnapshotSchema = z
  .object({
    sendMode: z.enum(reminderSendModeValues),
    sendRolloutPercent: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS),
    ),
    emergencyPauseEnabled: z.enum(reminderBooleanSelectValues),
    dispatchBatchSize: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES),
    ),
    eligibilityLimit: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS),
    ),
    syncEnabled: z.enum(reminderBooleanSelectValues),
    dispatchEnabled: z.enum(reminderBooleanSelectValues),
    queueEnabled: z.enum(reminderBooleanSelectValues),
    syncIntervalMs: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_SYNC_INTERVALS_MS),
    ),
    recoverySweepIntervalMs: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS),
    ),
    workerConcurrency: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_WORKER_CONCURRENCIES),
    ),
    lockTtlSeconds: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES),
    ),
    lockHeartbeatIntervalMs: z.enum(
      numberValuesToStringEnum(
        APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES,
      ),
    ),
    minConfirmationHours: z.enum(
      numberValuesToStringEnum(APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES),
    ),
  })
  .strict();

export const adminReminderRuntimeSettingsUpdateRequestSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(1).max(500).optional(),
    changes: reminderRuntimeSettingsSnapshotSchema.partial().superRefine(
      (value, ctx) => {
        if (Object.keys(value).length > 0) {
          return;
        }

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one settings change is required.',
        });
      },
    ),
  })
  .strict();
