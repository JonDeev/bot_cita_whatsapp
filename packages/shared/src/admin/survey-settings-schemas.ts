import { z } from 'zod';
import { ADMIN_ROLES } from './admin-role.js';
import {
  SURVEY_BOOLEAN_SELECT_VALUES,
  SURVEY_ELIGIBILITY_LIMIT_VALUES,
  SURVEY_EXPIRATION_HOURS_VALUES,
  SURVEY_MAX_DISPATCHES_PER_RUN_VALUES,
  SURVEY_RUNTIME_APPLY_MODES,
  SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS,
  SURVEY_RUNTIME_PROTECTED_SETTING_KEYS,
  SURVEY_RUNTIME_PRIMARY_SETTING_KEYS,
  SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS,
  SURVEY_RUNTIME_SCHEDULE_PROFILES,
  SURVEY_RUNTIME_SECTIONS,
  SURVEY_RUNTIME_SETTING_KEYS,
  SURVEY_SEND_MODES,
  SURVEY_SEND_ROLLOUT_PERCENT_VALUES,
  SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES,
  SURVEY_TICK_INTERVAL_MS_VALUES,
} from './survey-settings-dto.js';

const AdminRoleSchema = z.enum(ADMIN_ROLES);
const OptionalReasonSchema = z.string().trim().min(1).max(500).optional();

export const SurveyRuntimeSectionSchema = z.enum(SURVEY_RUNTIME_SECTIONS);
export const SurveyRuntimeApplyModeSchema = z.enum(SURVEY_RUNTIME_APPLY_MODES);
export const SurveySendModeSchema = z.enum(SURVEY_SEND_MODES);
export const SurveyBooleanSelectValueSchema = z.enum(
  SURVEY_BOOLEAN_SELECT_VALUES,
);
export const SurveyRuntimeSettingKeySchema = z.enum(
  SURVEY_RUNTIME_SETTING_KEYS,
);
export const SurveyRuntimeHotReloadableSettingKeySchema = z.enum(
  SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS,
);
export const SurveyRuntimeRestartScopedSettingKeySchema = z.enum(
  SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS,
);

export const SurveyRuntimeSettingsSnapshotSchema = z
  .object({
    sendMode: SurveySendModeSchema,
    sendRolloutPercent: z.enum(SURVEY_SEND_ROLLOUT_PERCENT_VALUES),
    emergencyPauseEnabled: SurveyBooleanSelectValueSchema,
    dispatchEnabled: SurveyBooleanSelectValueSchema,
    eligibilityLimit: z.enum(SURVEY_ELIGIBILITY_LIMIT_VALUES),
    expirationHours: z.enum(SURVEY_EXPIRATION_HOURS_VALUES),
    scheduleProfile: z.enum(SURVEY_RUNTIME_SCHEDULE_PROFILES),
    schedulerLoopEnabled: SurveyBooleanSelectValueSchema,
    tickIntervalMs: z.enum(SURVEY_TICK_INTERVAL_MS_VALUES),
    slotLockTtlSeconds: z.enum(SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES),
    maxDispatchesPerRun: z.enum(SURVEY_MAX_DISPATCHES_PER_RUN_VALUES),
  })
  .strict();

export const SurveyRuntimeHotReloadableSettingsSchema = z
  .object({
    sendMode: SurveySendModeSchema,
    sendRolloutPercent: z.enum(SURVEY_SEND_ROLLOUT_PERCENT_VALUES),
    emergencyPauseEnabled: SurveyBooleanSelectValueSchema,
    dispatchEnabled: SurveyBooleanSelectValueSchema,
    eligibilityLimit: z.enum(SURVEY_ELIGIBILITY_LIMIT_VALUES),
    expirationHours: z.enum(SURVEY_EXPIRATION_HOURS_VALUES),
    scheduleProfile: z.enum(SURVEY_RUNTIME_SCHEDULE_PROFILES),
    slotLockTtlSeconds: z.enum(SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES),
    maxDispatchesPerRun: z.enum(SURVEY_MAX_DISPATCHES_PER_RUN_VALUES),
  })
  .strict();

export const SurveyRuntimeSettingOptionValueSchema = z
  .object({
    value: z.string().min(1).max(32),
    label: z.string().min(1).max(120),
  })
  .strict();

export const SurveyRuntimeSettingFieldOptionSchema = z
  .object({
    key: SurveyRuntimeSettingKeySchema,
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    allowedValues: z.array(SurveyRuntimeSettingOptionValueSchema).min(1),
    editableByRoles: z.array(AdminRoleSchema).min(1),
    warningText: z.string().min(1).max(500).nullable(),
    applyMode: SurveyRuntimeApplyModeSchema,
    requiresReason: z.boolean(),
  })
  .strict();

export const SurveyRuntimeSettingsOptionsSchema = z
  .object({
    sections: z
      .object({
        primary: z.array(SurveyRuntimeSettingFieldOptionSchema),
        advanced: z.array(SurveyRuntimeSettingFieldOptionSchema),
        protected: z.array(SurveyRuntimeSettingFieldOptionSchema),
      })
      .strict(),
  })
  .strict();

const SurveyRuntimeSettingHistoryActorSchema = z
  .object({
    adminUserId: z.number().int().positive().nullable(),
    displayName: z.string().min(1).max(120).nullable(),
    username: z.string().min(1).max(32).nullable(),
  })
  .strict();

export const SurveyRuntimeSettingHistoryItemSchema = z
  .object({
    id: z.number().int().positive(),
    settingsVersion: z.number().int().positive(),
    changeType: z.string().min(1).max(64),
    section: SurveyRuntimeSectionSchema,
    reason: z.string().min(1).max(500).nullable(),
    occurredAtIso: z.string().datetime({ offset: true }),
    actor: SurveyRuntimeSettingHistoryActorSchema,
    previousSnapshot: SurveyRuntimeSettingsSnapshotSchema,
    newSnapshot: SurveyRuntimeSettingsSnapshotSchema,
    effectiveSnapshot: SurveyRuntimeSettingsSnapshotSchema,
  })
  .strict();

export const SurveyRuntimeSettingHistoryResultSchema = z
  .object({
    items: z.array(SurveyRuntimeSettingHistoryItemSchema),
  })
  .strict();

export const SurveyRuntimeSettingsSchema = z
  .object({
    stored: SurveyRuntimeSettingsSnapshotSchema,
    effectiveHotReloadable: SurveyRuntimeHotReloadableSettingsSchema,
    metadata: z
      .object({
        version: z.number().int().nonnegative(),
        lastUpdatedAtIso: z.string().datetime({ offset: true }),
        lastUpdatedByAdminUserId: z.number().int().positive().nullable(),
        emergencyPauseReason: z.string().min(1).max(500).nullable(),
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

export const SurveyRuntimeSettingsUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: OptionalReasonSchema,
    changes: SurveyRuntimeSettingsSnapshotSchema.partial().superRefine(
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

export const SurveyEmergencyPauseUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    emergencyPauseEnabled: SurveyBooleanSelectValueSchema,
  })
  .strict();
