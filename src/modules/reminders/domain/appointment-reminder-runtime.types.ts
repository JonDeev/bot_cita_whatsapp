import type {
  AdminRole,
  ReminderRuntimeApplyMode,
  ReminderRuntimeHotReloadableSettingKey,
  ReminderRuntimeSection,
  ReminderRuntimeSettingKey,
  ReminderRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';

export const APPOINTMENT_REMINDER_SEND_MODES = {
  MOCK: 'mock',
  LIVE: 'live',
} as const;

export type AppointmentReminderSendMode =
  (typeof APPOINTMENT_REMINDER_SEND_MODES)[keyof typeof APPOINTMENT_REMINDER_SEND_MODES];

export const APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS = [
  0, 5, 10, 25, 50, 75, 100,
] as const;

export type AppointmentReminderSendRolloutPercent =
  (typeof APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS)[number];

export const APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES = [
  10, 25, 50, 100,
] as const;

export type AppointmentReminderDispatchBatchSize =
  (typeof APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES)[number];

export const APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS = [
  100, 250, 500, 1000,
] as const;

export type AppointmentReminderEligibilityLimit =
  (typeof APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS)[number];

export const APPOINTMENT_REMINDER_SYNC_INTERVALS_MS = [
  60_000, 300_000, 600_000, 900_000,
] as const;

export type AppointmentReminderSyncIntervalMs =
  (typeof APPOINTMENT_REMINDER_SYNC_INTERVALS_MS)[number];

export const APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS = [
  60_000, 300_000, 600_000, 900_000,
] as const;

export type AppointmentReminderRecoverySweepIntervalMs =
  (typeof APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS)[number];

export const APPOINTMENT_REMINDER_WORKER_CONCURRENCIES = [1, 2, 3, 5] as const;

export type AppointmentReminderWorkerConcurrency =
  (typeof APPOINTMENT_REMINDER_WORKER_CONCURRENCIES)[number];

export const APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES = [
  120, 180, 300, 600,
] as const;

export type AppointmentReminderLockTtlSeconds =
  (typeof APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES)[number];

export const APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES = [
  30_000, 60_000, 120_000,
] as const;

export type AppointmentReminderLockHeartbeatIntervalMs =
  (typeof APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES)[number];

export const APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES = [
  3, 4, 6, 12,
] as const;

export type AppointmentReminderMinConfirmationHours =
  (typeof APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES)[number];

export interface AppointmentReminderRuntimeSettingsSnapshot {
  sendMode: AppointmentReminderSendMode;
  sendRolloutPercent: AppointmentReminderSendRolloutPercent;
  emergencyPauseEnabled: boolean;
  dispatchBatchSize: AppointmentReminderDispatchBatchSize;
  eligibilityLimit: AppointmentReminderEligibilityLimit;
  syncEnabled: boolean;
  dispatchEnabled: boolean;
  queueEnabled: boolean;
  syncIntervalMs: AppointmentReminderSyncIntervalMs;
  recoverySweepIntervalMs: AppointmentReminderRecoverySweepIntervalMs;
  workerConcurrency: AppointmentReminderWorkerConcurrency;
  lockTtlSeconds: AppointmentReminderLockTtlSeconds;
  lockHeartbeatIntervalMs: AppointmentReminderLockHeartbeatIntervalMs;
  minConfirmationHours: AppointmentReminderMinConfirmationHours;
}

export type AppointmentReminderHotReloadableSettings = Pick<
  AppointmentReminderRuntimeSettingsSnapshot,
  ReminderRuntimeHotReloadableSettingKey
>;

export type AppointmentReminderRestartScopedSettings = Pick<
  AppointmentReminderRuntimeSettingsSnapshot,
  | 'syncEnabled'
  | 'dispatchEnabled'
  | 'queueEnabled'
  | 'syncIntervalMs'
  | 'recoverySweepIntervalMs'
  | 'workerConcurrency'
>;

export const APPOINTMENT_REMINDER_RUNTIME_PRIMARY_FIELDS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
] as const;

export const APPOINTMENT_REMINDER_RUNTIME_ADVANCED_FIELDS = [
  'dispatchBatchSize',
  'eligibilityLimit',
] as const;

export const APPOINTMENT_REMINDER_RUNTIME_PROTECTED_FIELDS = [
  'syncEnabled',
  'dispatchEnabled',
  'queueEnabled',
  'syncIntervalMs',
  'recoverySweepIntervalMs',
  'workerConcurrency',
  'lockTtlSeconds',
  'lockHeartbeatIntervalMs',
  'minConfirmationHours',
] as const;

export const APPOINTMENT_REMINDER_RUNTIME_SECTION_FIELDS = {
  primary: APPOINTMENT_REMINDER_RUNTIME_PRIMARY_FIELDS,
  advanced: APPOINTMENT_REMINDER_RUNTIME_ADVANCED_FIELDS,
  protected: APPOINTMENT_REMINDER_RUNTIME_PROTECTED_FIELDS,
} as const;

export const APPOINTMENT_REMINDER_RUNTIME_HOT_RELOADABLE_FIELDS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
  'dispatchBatchSize',
  'eligibilityLimit',
  'lockTtlSeconds',
  'lockHeartbeatIntervalMs',
  'minConfirmationHours',
] as const satisfies readonly ReminderRuntimeHotReloadableSettingKey[];

export const APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS = [
  'syncEnabled',
  'dispatchEnabled',
  'queueEnabled',
  'syncIntervalMs',
  'recoverySweepIntervalMs',
  'workerConcurrency',
] as const;

export interface AppointmentReminderRuntimeFieldDefinition<
  K extends ReminderRuntimeSettingKey = ReminderRuntimeSettingKey,
> {
  key: K;
  section: ReminderRuntimeSection;
  applyMode: ReminderRuntimeApplyMode;
  editableByRoles: readonly AdminRole[];
  requiresReason: boolean;
  label: string;
  description: string;
  warningText: string | null;
  dtoAllowedValues: readonly ReminderRuntimeSettingsSnapshotDto[K][];
  domainAllowedValues: readonly AppointmentReminderRuntimeSettingsSnapshot[K][];
}

export const APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT = 'default';

export const APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES = {
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  EMERGENCY_PAUSE_ENABLED: 'EMERGENCY_PAUSE_ENABLED',
  EMERGENCY_PAUSE_DISABLED: 'EMERGENCY_PAUSE_DISABLED',
  DEFAULTS_SEEDED: 'DEFAULTS_SEEDED',
} as const;

export type AppointmentReminderRuntimeSettingChangeType =
  (typeof APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES)[keyof typeof APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES];

export interface AppointmentReminderRuntimeSettingsRecord {
  id: number;
  scopeKey: string;
  version: number;
  snapshot: AppointmentReminderRuntimeSettingsSnapshot;
  updatedByAdminUserId: number | null;
  updatedAtIso: string;
  createdAtIso: string;
}

export interface AppointmentReminderRuntimeSettingEventRecord {
  id: number;
  settingsVersion: number;
  adminUserId: number | null;
  actor: {
    displayName: string | null;
    username: string | null;
  };
  changeType: AppointmentReminderRuntimeSettingChangeType;
  section: ReminderRuntimeSection;
  reason: string | null;
  previousSnapshot: AppointmentReminderRuntimeSettingsSnapshot;
  newSnapshot: AppointmentReminderRuntimeSettingsSnapshot;
  effectiveSnapshot: AppointmentReminderRuntimeSettingsSnapshot;
  occurredAtIso: string;
  createdAtIso: string;
}
