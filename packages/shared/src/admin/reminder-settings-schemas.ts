import { z } from 'zod';
import { ADMIN_ROLES } from './admin-role.js';
import {
  REMINDER_BOOLEAN_SELECT_VALUES,
  REMINDER_DISPATCH_BATCH_SIZE_VALUES,
  REMINDER_ELIGIBILITY_LIMIT_VALUES,
  REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES,
  REMINDER_LOCK_TTL_SECONDS_VALUES,
  REMINDER_MIN_CONFIRMATION_HOURS_VALUES,
  REMINDER_RECOVERY_SWEEP_INTERVAL_MS_VALUES,
  REMINDER_RUNTIME_APPLY_MODES,
  REMINDER_RUNTIME_HOT_RELOADABLE_SETTING_KEYS,
  REMINDER_RUNTIME_RESTART_SCOPED_SETTING_KEYS,
  REMINDER_RUNTIME_SECTIONS,
  REMINDER_RUNTIME_SETTING_KEYS,
  REMINDER_SEND_MODES,
  REMINDER_SEND_ROLLOUT_PERCENT_VALUES,
  REMINDER_SYNC_INTERVAL_MS_VALUES,
  REMINDER_WORKER_CONCURRENCY_VALUES,
} from './reminder-settings-dto.js';

export const ReminderRuntimeSectionSchema = z.enum(REMINDER_RUNTIME_SECTIONS);
export const ReminderRuntimeApplyModeSchema = z.enum(
  REMINDER_RUNTIME_APPLY_MODES,
);
export const ReminderSendModeSchema = z.enum(REMINDER_SEND_MODES);
export const ReminderBooleanSelectValueSchema = z.enum(
  REMINDER_BOOLEAN_SELECT_VALUES,
);
export const ReminderRuntimeSettingKeySchema = z.enum(
  REMINDER_RUNTIME_SETTING_KEYS,
);
export const ReminderRuntimeHotReloadableSettingKeySchema = z.enum(
  REMINDER_RUNTIME_HOT_RELOADABLE_SETTING_KEYS,
);
export const ReminderRuntimeRestartScopedSettingKeySchema = z.enum(
  REMINDER_RUNTIME_RESTART_SCOPED_SETTING_KEYS,
);

const AdminRoleSchema = z.enum(ADMIN_ROLES);
const OptionalReasonSchema = z.string().trim().min(1).max(500).optional();

export const ReminderRuntimeSettingsSnapshotSchema = z
  .object({
    sendMode: ReminderSendModeSchema,
    sendRolloutPercent: z.enum(REMINDER_SEND_ROLLOUT_PERCENT_VALUES),
    emergencyPauseEnabled: ReminderBooleanSelectValueSchema,
    dispatchBatchSize: z.enum(REMINDER_DISPATCH_BATCH_SIZE_VALUES),
    eligibilityLimit: z.enum(REMINDER_ELIGIBILITY_LIMIT_VALUES),
    syncEnabled: ReminderBooleanSelectValueSchema,
    dispatchEnabled: ReminderBooleanSelectValueSchema,
    queueEnabled: ReminderBooleanSelectValueSchema,
    syncIntervalMs: z.enum(REMINDER_SYNC_INTERVAL_MS_VALUES),
    recoverySweepIntervalMs: z.enum(REMINDER_RECOVERY_SWEEP_INTERVAL_MS_VALUES),
    workerConcurrency: z.enum(REMINDER_WORKER_CONCURRENCY_VALUES),
    lockTtlSeconds: z.enum(REMINDER_LOCK_TTL_SECONDS_VALUES),
    lockHeartbeatIntervalMs: z.enum(REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES),
    minConfirmationHours: z.enum(REMINDER_MIN_CONFIRMATION_HOURS_VALUES),
  })
  .strict();

export const ReminderRuntimeHotReloadableSettingsSchema = z
  .object({
    sendMode: ReminderSendModeSchema,
    sendRolloutPercent: z.enum(REMINDER_SEND_ROLLOUT_PERCENT_VALUES),
    emergencyPauseEnabled: ReminderBooleanSelectValueSchema,
    dispatchBatchSize: z.enum(REMINDER_DISPATCH_BATCH_SIZE_VALUES),
    eligibilityLimit: z.enum(REMINDER_ELIGIBILITY_LIMIT_VALUES),
    lockTtlSeconds: z.enum(REMINDER_LOCK_TTL_SECONDS_VALUES),
    lockHeartbeatIntervalMs: z.enum(REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES),
    minConfirmationHours: z.enum(REMINDER_MIN_CONFIRMATION_HOURS_VALUES),
  })
  .strict();

export const ReminderRuntimeSettingOptionValueSchema = z
  .object({
    value: z.string().min(1).max(32),
    label: z.string().min(1).max(120),
  })
  .strict();

export const ReminderRuntimeSettingFieldOptionSchema = z
  .object({
    key: ReminderRuntimeSettingKeySchema,
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    allowedValues: z.array(ReminderRuntimeSettingOptionValueSchema).min(1),
    editableByRoles: z.array(AdminRoleSchema).min(1),
    warningText: z.string().min(1).max(500).nullable(),
    applyMode: ReminderRuntimeApplyModeSchema,
    requiresReason: z.boolean(),
  })
  .strict();

export const ReminderRuntimeSettingsOptionsSchema = z
  .object({
    sections: z
      .object({
        primary: z.array(ReminderRuntimeSettingFieldOptionSchema),
        advanced: z.array(ReminderRuntimeSettingFieldOptionSchema),
        protected: z.array(ReminderRuntimeSettingFieldOptionSchema),
      })
      .strict(),
  })
  .strict();

export const ReminderRuntimeSettingsSchema = z
  .object({
    stored: ReminderRuntimeSettingsSnapshotSchema,
    effectiveHotReloadable: ReminderRuntimeHotReloadableSettingsSchema,
    metadata: z
      .object({
        version: z.number().int().nonnegative(),
        lastUpdatedAtIso: z.string().datetime({ offset: true }),
        lastUpdatedByAdminUserId: z.number().int().positive().nullable(),
        emergencyPauseReason: z.string().min(1).max(500).nullable(),
      })
      .strict(),
    runtimeApplication: z
      .object({
        restartScopedFieldKeys: z.array(
          ReminderRuntimeRestartScopedSettingKeySchema,
        ),
        restartScopedApplyNote: z.string().min(1).max(500),
      })
      .strict(),
    permissions: z
      .object({
        canEditPrimary: z.boolean(),
        canEditAdvanced: z.boolean(),
        canEditProtected: z.boolean(),
        canToggleEmergencyPause: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const ReminderRuntimeSettingsUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: OptionalReasonSchema,
    changes: ReminderRuntimeSettingsSnapshotSchema.partial().superRefine(
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

export const ReminderEmergencyPauseUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    emergencyPauseEnabled: ReminderBooleanSelectValueSchema,
  })
  .strict();

export type ReminderRuntimeSettingsSnapshot = z.infer<
  typeof ReminderRuntimeSettingsSnapshotSchema
>;
export type ReminderRuntimeHotReloadableSettings = z.infer<
  typeof ReminderRuntimeHotReloadableSettingsSchema
>;
export type ReminderRuntimeSettingsOptions = z.infer<
  typeof ReminderRuntimeSettingsOptionsSchema
>;
export type ReminderRuntimeSettings = z.infer<
  typeof ReminderRuntimeSettingsSchema
>;
export type ReminderRuntimeSettingsUpdateRequest = z.infer<
  typeof ReminderRuntimeSettingsUpdateRequestSchema
>;
export type ReminderEmergencyPauseUpdateRequest = z.infer<
  typeof ReminderEmergencyPauseUpdateRequestSchema
>;
