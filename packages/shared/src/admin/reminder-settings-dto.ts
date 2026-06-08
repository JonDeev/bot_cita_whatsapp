import type { AdminRole } from './admin-role.js';

export const REMINDER_RUNTIME_SECTIONS = [
  'primary',
  'advanced',
  'protected',
] as const;

export type ReminderRuntimeSection =
  (typeof REMINDER_RUNTIME_SECTIONS)[number];

export const REMINDER_RUNTIME_APPLY_MODES = [
  'immediate',
  'restart_required',
] as const;

export type ReminderRuntimeApplyMode =
  (typeof REMINDER_RUNTIME_APPLY_MODES)[number];

export const REMINDER_SEND_MODES = ['mock', 'live'] as const;

export type ReminderSendMode = (typeof REMINDER_SEND_MODES)[number];

export const REMINDER_BOOLEAN_SELECT_VALUES = [
  'enabled',
  'disabled',
] as const;

export type ReminderBooleanSelectValue =
  (typeof REMINDER_BOOLEAN_SELECT_VALUES)[number];

export const REMINDER_RUNTIME_PRIMARY_SETTING_KEYS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
] as const;

export const REMINDER_RUNTIME_ADVANCED_SETTING_KEYS = [
  'dispatchBatchSize',
  'eligibilityLimit',
] as const;

export const REMINDER_RUNTIME_PROTECTED_SETTING_KEYS = [
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

export const REMINDER_RUNTIME_SETTING_KEYS = [
  ...REMINDER_RUNTIME_PRIMARY_SETTING_KEYS,
  ...REMINDER_RUNTIME_ADVANCED_SETTING_KEYS,
  ...REMINDER_RUNTIME_PROTECTED_SETTING_KEYS,
] as const;

export type ReminderRuntimeSettingKey =
  (typeof REMINDER_RUNTIME_SETTING_KEYS)[number];

export const REMINDER_RUNTIME_HOT_RELOADABLE_SETTING_KEYS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
  'dispatchBatchSize',
  'eligibilityLimit',
  'lockTtlSeconds',
  'lockHeartbeatIntervalMs',
  'minConfirmationHours',
] as const;

export type ReminderRuntimeHotReloadableSettingKey =
  (typeof REMINDER_RUNTIME_HOT_RELOADABLE_SETTING_KEYS)[number];

export const REMINDER_RUNTIME_RESTART_SCOPED_SETTING_KEYS = [
  'syncEnabled',
  'dispatchEnabled',
  'queueEnabled',
  'syncIntervalMs',
  'recoverySweepIntervalMs',
  'workerConcurrency',
] as const;

export type ReminderRuntimeRestartScopedSettingKey =
  (typeof REMINDER_RUNTIME_RESTART_SCOPED_SETTING_KEYS)[number];

export const REMINDER_SEND_ROLLOUT_PERCENT_VALUES = [
  '0',
  '5',
  '10',
  '25',
  '50',
  '75',
  '100',
] as const;

export type ReminderSendRolloutPercentValue =
  (typeof REMINDER_SEND_ROLLOUT_PERCENT_VALUES)[number];

export const REMINDER_DISPATCH_BATCH_SIZE_VALUES = [
  '10',
  '25',
  '50',
  '100',
] as const;

export type ReminderDispatchBatchSizeValue =
  (typeof REMINDER_DISPATCH_BATCH_SIZE_VALUES)[number];

export const REMINDER_ELIGIBILITY_LIMIT_VALUES = [
  '100',
  '250',
  '500',
  '1000',
] as const;

export type ReminderEligibilityLimitValue =
  (typeof REMINDER_ELIGIBILITY_LIMIT_VALUES)[number];

export const REMINDER_SYNC_INTERVAL_MS_VALUES = [
  '60000',
  '300000',
  '600000',
  '900000',
] as const;

export type ReminderSyncIntervalMsValue =
  (typeof REMINDER_SYNC_INTERVAL_MS_VALUES)[number];

export const REMINDER_RECOVERY_SWEEP_INTERVAL_MS_VALUES = [
  '60000',
  '300000',
  '600000',
  '900000',
] as const;

export type ReminderRecoverySweepIntervalMsValue =
  (typeof REMINDER_RECOVERY_SWEEP_INTERVAL_MS_VALUES)[number];

export const REMINDER_WORKER_CONCURRENCY_VALUES = [
  '1',
  '2',
  '3',
  '5',
] as const;

export type ReminderWorkerConcurrencyValue =
  (typeof REMINDER_WORKER_CONCURRENCY_VALUES)[number];

export const REMINDER_LOCK_TTL_SECONDS_VALUES = [
  '120',
  '180',
  '300',
  '600',
] as const;

export type ReminderLockTtlSecondsValue =
  (typeof REMINDER_LOCK_TTL_SECONDS_VALUES)[number];

export const REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES = [
  '30000',
  '60000',
  '120000',
] as const;

export type ReminderLockHeartbeatIntervalMsValue =
  (typeof REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES)[number];

export const REMINDER_MIN_CONFIRMATION_HOURS_VALUES = [
  '3',
  '4',
  '6',
  '12',
] as const;

export type ReminderMinConfirmationHoursValue =
  (typeof REMINDER_MIN_CONFIRMATION_HOURS_VALUES)[number];

export interface ReminderRuntimeSettingsSnapshotDto {
  sendMode: ReminderSendMode;
  sendRolloutPercent: ReminderSendRolloutPercentValue;
  emergencyPauseEnabled: ReminderBooleanSelectValue;
  dispatchBatchSize: ReminderDispatchBatchSizeValue;
  eligibilityLimit: ReminderEligibilityLimitValue;
  syncEnabled: ReminderBooleanSelectValue;
  dispatchEnabled: ReminderBooleanSelectValue;
  queueEnabled: ReminderBooleanSelectValue;
  syncIntervalMs: ReminderSyncIntervalMsValue;
  recoverySweepIntervalMs: ReminderRecoverySweepIntervalMsValue;
  workerConcurrency: ReminderWorkerConcurrencyValue;
  lockTtlSeconds: ReminderLockTtlSecondsValue;
  lockHeartbeatIntervalMs: ReminderLockHeartbeatIntervalMsValue;
  minConfirmationHours: ReminderMinConfirmationHoursValue;
}

export type ReminderRuntimeHotReloadableSettingsDto = Pick<
  ReminderRuntimeSettingsSnapshotDto,
  ReminderRuntimeHotReloadableSettingKey
>;

export interface ReminderRuntimeSettingOptionValueDto {
  value: string;
  label: string;
}

export interface ReminderRuntimeSettingFieldOptionDto {
  key: ReminderRuntimeSettingKey;
  label: string;
  description: string;
  allowedValues: ReminderRuntimeSettingOptionValueDto[];
  editableByRoles: AdminRole[];
  warningText: string | null;
  applyMode: ReminderRuntimeApplyMode;
  requiresReason: boolean;
}

export interface ReminderRuntimeSettingsOptionsDto {
  sections: {
    primary: ReminderRuntimeSettingFieldOptionDto[];
    advanced: ReminderRuntimeSettingFieldOptionDto[];
    protected: ReminderRuntimeSettingFieldOptionDto[];
  };
}

export interface ReminderRuntimeSettingsDto {
  stored: ReminderRuntimeSettingsSnapshotDto;
  effectiveHotReloadable: ReminderRuntimeHotReloadableSettingsDto;
  metadata: {
    version: number;
    lastUpdatedAtIso: string;
    lastUpdatedByAdminUserId: number | null;
    emergencyPauseReason: string | null;
  };
  runtimeApplication: {
    restartScopedFieldKeys: ReminderRuntimeRestartScopedSettingKey[];
    restartScopedApplyNote: string;
  };
  permissions: {
    canEditPrimary: boolean;
    canEditAdvanced: boolean;
    canEditProtected: boolean;
    canToggleEmergencyPause: boolean;
  };
}

export interface ReminderRuntimeSettingsUpdateRequestDto {
  expectedVersion: number;
  reason?: string;
  changes: Partial<ReminderRuntimeSettingsSnapshotDto>;
}

export interface ReminderEmergencyPauseUpdateRequestDto {
  expectedVersion: number;
  reason: string;
  emergencyPauseEnabled: ReminderBooleanSelectValue;
}
