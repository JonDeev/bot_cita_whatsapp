import type { AdminRole } from './admin-role.js';

export const SURVEY_RUNTIME_SECTIONS = [
  'primary',
  'advanced',
  'protected',
] as const;

export type SurveyRuntimeSection = (typeof SURVEY_RUNTIME_SECTIONS)[number];

export const SURVEY_RUNTIME_APPLY_MODES = [
  'immediate',
  'restart_required',
] as const;

export type SurveyRuntimeApplyMode =
  (typeof SURVEY_RUNTIME_APPLY_MODES)[number];

export const SURVEY_SEND_MODES = ['mock', 'live'] as const;

export type SurveySendMode = (typeof SURVEY_SEND_MODES)[number];

export const SURVEY_BOOLEAN_SELECT_VALUES = [
  'enabled',
  'disabled',
] as const;

export type SurveyBooleanSelectValue =
  (typeof SURVEY_BOOLEAN_SELECT_VALUES)[number];

export const SURVEY_RUNTIME_SETTING_KEYS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
  'schedulerLoopEnabled',
  'tickIntervalMs',
  'slotLockTtlSeconds',
  'maxDispatchesPerRun',
] as const;

export type SurveyRuntimeSettingKey =
  (typeof SURVEY_RUNTIME_SETTING_KEYS)[number];

export const SURVEY_RUNTIME_PRIMARY_SETTING_KEYS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
] as const;

export const SURVEY_RUNTIME_ADVANCED_SETTING_KEYS = [
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
] as const;

export const SURVEY_RUNTIME_PROTECTED_SETTING_KEYS = [
  'schedulerLoopEnabled',
  'tickIntervalMs',
  'slotLockTtlSeconds',
  'maxDispatchesPerRun',
] as const;

export const SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
  'slotLockTtlSeconds',
  'maxDispatchesPerRun',
] as const;

export type SurveyRuntimeHotReloadableSettingKey =
  (typeof SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS)[number];

export const SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS = [
  'schedulerLoopEnabled',
  'tickIntervalMs',
] as const;

export type SurveyRuntimeRestartScopedSettingKey =
  (typeof SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS)[number];

export const SURVEY_RUNTIME_SCHEDULE_PROFILES = [
  'business_hours_mon_fri',
  'extended_hours_mon_fri',
  'business_hours_mon_sat',
] as const;

export type SurveyRuntimeScheduleProfile =
  (typeof SURVEY_RUNTIME_SCHEDULE_PROFILES)[number];

export const SURVEY_SEND_ROLLOUT_PERCENT_VALUES = [
  '0',
  '5',
  '10',
  '25',
  '50',
  '75',
  '100',
] as const;

export type SurveySendRolloutPercentValue =
  (typeof SURVEY_SEND_ROLLOUT_PERCENT_VALUES)[number];

export const SURVEY_ELIGIBILITY_LIMIT_VALUES = [
  '100',
  '250',
  '500',
  '1000',
] as const;

export type SurveyEligibilityLimitValue =
  (typeof SURVEY_ELIGIBILITY_LIMIT_VALUES)[number];

export const SURVEY_EXPIRATION_HOURS_VALUES = [
  '12',
  '24',
  '36',
  '48',
] as const;

export type SurveyExpirationHoursValue =
  (typeof SURVEY_EXPIRATION_HOURS_VALUES)[number];

export const SURVEY_TICK_INTERVAL_MS_VALUES = [
  '30000',
  '60000',
  '300000',
] as const;

export type SurveyTickIntervalMsValue =
  (typeof SURVEY_TICK_INTERVAL_MS_VALUES)[number];

export const SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES = [
  '1200',
  '1800',
  '2100',
  '2700',
] as const;

export type SurveySlotLockTtlSecondsValue =
  (typeof SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES)[number];

export const SURVEY_MAX_DISPATCHES_PER_RUN_VALUES = [
  '25',
  '50',
  '100',
  '200',
] as const;

export type SurveyMaxDispatchesPerRunValue =
  (typeof SURVEY_MAX_DISPATCHES_PER_RUN_VALUES)[number];

export interface SurveyRuntimeSettingsSnapshotDto {
  sendMode: SurveySendMode;
  sendRolloutPercent: SurveySendRolloutPercentValue;
  emergencyPauseEnabled: SurveyBooleanSelectValue;
  dispatchEnabled: SurveyBooleanSelectValue;
  eligibilityLimit: SurveyEligibilityLimitValue;
  expirationHours: SurveyExpirationHoursValue;
  scheduleProfile: SurveyRuntimeScheduleProfile;
  schedulerLoopEnabled: SurveyBooleanSelectValue;
  tickIntervalMs: SurveyTickIntervalMsValue;
  slotLockTtlSeconds: SurveySlotLockTtlSecondsValue;
  maxDispatchesPerRun: SurveyMaxDispatchesPerRunValue;
}

export type SurveyRuntimeHotReloadableSettingsDto = Pick<
  SurveyRuntimeSettingsSnapshotDto,
  SurveyRuntimeHotReloadableSettingKey
>;

export interface SurveyRuntimeSettingOptionValueDto {
  value: string;
  label: string;
}

export interface SurveyRuntimeSettingFieldOptionDto {
  key: SurveyRuntimeSettingKey;
  label: string;
  description: string;
  allowedValues: SurveyRuntimeSettingOptionValueDto[];
  editableByRoles: AdminRole[];
  warningText: string | null;
  applyMode: SurveyRuntimeApplyMode;
  requiresReason: boolean;
}

export interface SurveyRuntimeSettingsOptionsDto {
  sections: {
    primary: SurveyRuntimeSettingFieldOptionDto[];
    advanced: SurveyRuntimeSettingFieldOptionDto[];
    protected: SurveyRuntimeSettingFieldOptionDto[];
  };
}

export interface SurveyRuntimeSettingsDto {
  stored: SurveyRuntimeSettingsSnapshotDto;
  effectiveHotReloadable: SurveyRuntimeHotReloadableSettingsDto;
  metadata: {
    version: number;
    lastUpdatedAtIso: string;
    lastUpdatedByAdminUserId: number | null;
    emergencyPauseReason: string | null;
  };
  permissions: {
    canEditPrimary: boolean;
    canEditAdvanced: boolean;
    canEditProtected: boolean;
    canToggleEmergencyPause: boolean;
  };
}

export interface SurveyRuntimeSettingsUpdateRequestDto {
  expectedVersion: number;
  reason?: string;
  changes: Partial<SurveyRuntimeSettingsSnapshotDto>;
}

export interface SurveyEmergencyPauseUpdateRequestDto {
  expectedVersion: number;
  reason: string;
  emergencyPauseEnabled: SurveyBooleanSelectValue;
}

export interface SurveyRuntimeSettingHistoryActorDto {
  adminUserId: number | null;
  displayName: string | null;
  username: string | null;
}

export interface SurveyRuntimeSettingHistoryItemDto {
  id: number;
  settingsVersion: number;
  changeType: string;
  section: SurveyRuntimeSection;
  reason: string | null;
  occurredAtIso: string;
  actor: SurveyRuntimeSettingHistoryActorDto;
  previousSnapshot: SurveyRuntimeSettingsSnapshotDto;
  newSnapshot: SurveyRuntimeSettingsSnapshotDto;
  effectiveSnapshot: SurveyRuntimeSettingsSnapshotDto;
}

export interface SurveyRuntimeSettingHistoryResultDto {
  items: SurveyRuntimeSettingHistoryItemDto[];
}
