import type {
  AdminRole,
  SurveyRuntimeApplyMode,
  SurveyRuntimeSection,
  SurveyRuntimeScheduleProfile,
  SurveyRuntimeSettingKey,
  SurveyRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';

export const SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT = 'default';

export const SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES = {
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  EMERGENCY_PAUSE_ENABLED: 'EMERGENCY_PAUSE_ENABLED',
  EMERGENCY_PAUSE_DISABLED: 'EMERGENCY_PAUSE_DISABLED',
  DEFAULTS_SEEDED: 'DEFAULTS_SEEDED',
} as const;

export type SatisfactionSurveyRuntimeSettingChangeType =
  (typeof SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES)[keyof typeof SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES];

export interface SatisfactionSurveyRuntimeSettingsSnapshot {
  sendMode: SurveyRuntimeSettingsSnapshotDto['sendMode'];
  sendRolloutPercent: number;
  emergencyPauseEnabled: boolean;
  dispatchEnabled: boolean;
  eligibilityLimit: number;
  expirationHours: number;
  scheduleProfile: SurveyRuntimeScheduleProfile;
  schedulerLoopEnabled: boolean;
  tickIntervalMs: number;
  slotLockTtlSeconds: number;
  maxDispatchesPerRun: number;
}

export type SatisfactionSurveyRuntimeHotReloadableSettings = Pick<
  SatisfactionSurveyRuntimeSettingsSnapshot,
  | 'sendMode'
  | 'sendRolloutPercent'
  | 'emergencyPauseEnabled'
  | 'dispatchEnabled'
  | 'eligibilityLimit'
  | 'expirationHours'
  | 'scheduleProfile'
  | 'slotLockTtlSeconds'
  | 'maxDispatchesPerRun'
>;

export type SatisfactionSurveyRuntimeRestartScopedSettings = Pick<
  SatisfactionSurveyRuntimeSettingsSnapshot,
  'schedulerLoopEnabled' | 'tickIntervalMs'
>;

export const SATISFACTION_SURVEY_RUNTIME_PRIMARY_FIELDS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
] as const;

export const SATISFACTION_SURVEY_RUNTIME_ADVANCED_FIELDS = [
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
] as const;

export const SATISFACTION_SURVEY_RUNTIME_PROTECTED_FIELDS = [
  'schedulerLoopEnabled',
  'tickIntervalMs',
  'slotLockTtlSeconds',
  'maxDispatchesPerRun',
] as const;

export const SATISFACTION_SURVEY_RUNTIME_SECTION_FIELDS = {
  primary: SATISFACTION_SURVEY_RUNTIME_PRIMARY_FIELDS,
  advanced: SATISFACTION_SURVEY_RUNTIME_ADVANCED_FIELDS,
  protected: SATISFACTION_SURVEY_RUNTIME_PROTECTED_FIELDS,
} as const;

export const SATISFACTION_SURVEY_RUNTIME_HOT_RELOADABLE_FIELDS = [
  'sendMode',
  'sendRolloutPercent',
  'emergencyPauseEnabled',
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
  'slotLockTtlSeconds',
  'maxDispatchesPerRun',
] as const satisfies readonly SurveyRuntimeSettingKey[];

export const SATISFACTION_SURVEY_RUNTIME_RESTART_SCOPED_FIELDS = [
  'schedulerLoopEnabled',
  'tickIntervalMs',
] as const satisfies readonly SurveyRuntimeSettingKey[];

export const SATISFACTION_SURVEY_RUNTIME_APPLY_MODE_BY_KEY: Record<
  SurveyRuntimeSettingKey,
  SurveyRuntimeApplyMode
> = {
  sendMode: 'immediate',
  sendRolloutPercent: 'immediate',
  emergencyPauseEnabled: 'immediate',
  dispatchEnabled: 'immediate',
  eligibilityLimit: 'immediate',
  expirationHours: 'immediate',
  scheduleProfile: 'immediate',
  schedulerLoopEnabled: 'restart_required',
  tickIntervalMs: 'restart_required',
  slotLockTtlSeconds: 'immediate',
  maxDispatchesPerRun: 'immediate',
};

export const SATISFACTION_SURVEY_RUNTIME_CHANGE_TYPE_BY_EMERGENCY_PAUSE = {
  true: SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
  false: SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
} as const;

export interface SatisfactionSurveyRuntimeFieldDefinition<
  K extends SurveyRuntimeSettingKey = SurveyRuntimeSettingKey,
> {
  key: K;
  section: SurveyRuntimeSection;
  applyMode: SurveyRuntimeApplyMode;
  editableByRoles: readonly AdminRole[];
  requiresReason: boolean;
  label: string;
  description: string;
  warningText: string | null;
  dtoAllowedValues: readonly SurveyRuntimeSettingsSnapshotDto[K][];
  domainAllowedValues: readonly SatisfactionSurveyRuntimeSettingsSnapshot[K][];
}

export interface SatisfactionSurveyRuntimeSettingsRecord {
  id: number;
  scopeKey: string;
  version: number;
  snapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  updatedByAdminUserId: number | null;
  updatedAtIso: string;
  createdAtIso: string;
}

export interface SatisfactionSurveyRuntimeSettingEventRecord {
  id: number;
  settingsVersion: number;
  adminUserId: number | null;
  actor: {
    displayName: string | null;
    username: string | null;
  };
  changeType: SatisfactionSurveyRuntimeSettingChangeType;
  section: SurveyRuntimeSection;
  reason: string | null;
  previousSnapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  newSnapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  effectiveSnapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  occurredAtIso: string;
  createdAtIso: string;
}
