import type {
  SurveyRuntimeApplyMode,
  SurveyRuntimeSection,
  SurveyRuntimeSettingFieldOptionDto,
  SurveyRuntimeSettingHistoryItemDto,
  SurveyRuntimeSettingHistoryResultDto,
  SurveyRuntimeSettingKey,
  SurveyRuntimeSettingsDto,
  SurveyRuntimeSettingsOptionsDto,
  SurveyRuntimeSettingsUpdateRequestDto,
  SurveyEmergencyPauseUpdateRequestDto,
} from '@whatsapp-bot/shared';

export type SurveyRuntimeSettings = SurveyRuntimeSettingsDto;
export type SurveyRuntimeSettingsOptions = SurveyRuntimeSettingsOptionsDto;
export type SurveyRuntimeSettingsUpdateRequest =
  SurveyRuntimeSettingsUpdateRequestDto;
export type SurveyEmergencyPauseUpdateRequest =
  SurveyEmergencyPauseUpdateRequestDto;
export type SurveyRuntimeSettingOption = SurveyRuntimeSettingFieldOptionDto;
export type SurveyRuntimeSettingKeyValue = SurveyRuntimeSettingKey;
export type SurveyRuntimeSectionValue = SurveyRuntimeSection;
export type SurveyRuntimeApplyModeValue = SurveyRuntimeApplyMode;
export type SurveyRuntimeSettingHistoryItem = SurveyRuntimeSettingHistoryItemDto;
export type SurveyRuntimeSettingHistoryResult = SurveyRuntimeSettingHistoryResultDto;

const SECTION_LABELS: Record<SurveyRuntimeSectionValue, string> = {
  primary: 'Controles primarios',
  advanced: 'Configuracion avanzada',
  protected: 'Configuracion protegida',
};

const APPLY_MODE_LABELS: Record<SurveyRuntimeApplyModeValue, string> = {
  immediate: 'Aplica de inmediato',
  restart_required: 'Requiere reinicio controlado',
};

const SEND_MODE_LABELS: Record<string, string> = {
  mock: 'Mock',
  live: 'Live',
};

const SCHEDULE_PROFILE_LABELS: Record<string, string> = {
  business_hours_mon_fri: 'Horario laboral lun-vie',
  extended_hours_mon_fri: 'Horario extendido lun-vie',
  business_hours_mon_sat: 'Horario laboral lun-sáb',
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  SETTINGS_UPDATED: 'Configuracion actualizada',
  EMERGENCY_PAUSE_ENABLED: 'Pausa de emergencia activada',
  EMERGENCY_PAUSE_DISABLED: 'Pausa de emergencia desactivada',
  DEFAULTS_SEEDED: 'Valores bootstrap sembrados',
};

const MACHINE_CODE_PATTERN = /^[A-Z0-9_.-]+$/;

function labelFromMap(value: string, labels: Record<string, string>): string {
  if (!value) {
    return '-';
  }

  const mapped = labels[value];
  if (mapped) {
    return mapped;
  }

  if (MACHINE_CODE_PATTERN.test(value)) {
    return value
      .toLowerCase()
      .replace(/[_.-]+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  return value;
}

export function formatSurveyRuntimeSectionLabel(
  section: SurveyRuntimeSectionValue,
): string {
  return SECTION_LABELS[section];
}

export function formatSurveyRuntimeApplyModeLabel(
  applyMode: SurveyRuntimeApplyModeValue,
): string {
  return APPLY_MODE_LABELS[applyMode];
}

export function formatSurveyRuntimeSendModeLabel(value: string): string {
  return labelFromMap(value, SEND_MODE_LABELS);
}

export function formatSurveyRuntimeScheduleProfileLabel(value: string): string {
  return labelFromMap(value, SCHEDULE_PROFILE_LABELS);
}

export function formatSurveyRuntimeChangeTypeLabel(value: string): string {
  return labelFromMap(value, CHANGE_TYPE_LABELS);
}

export function formatSurveyRuntimeAllowedRolesLabel(
  roles: readonly string[],
): string {
  if (roles.length === 0) {
    return 'Sin rol';
  }

  return roles
    .map((role) => {
      if (role === 'ADMIN') {
        return 'ADMIN';
      }

      if (role === 'SUPERVISOR') {
        return 'SUPERVISOR';
      }

      return role;
    })
    .join(' / ');
}

export function formatSurveyRuntimeGlobalStateLabel(
  settings: SurveyRuntimeSettings,
): {
  label: string;
  tone: 'neutral' | 'warning' | 'success';
  description: string;
} {
  if (settings.stored.emergencyPauseEnabled === 'enabled') {
    return {
      label: 'Pausado',
      tone: 'warning',
      description:
        'La pausa de emergencia bloquea los envios reales mientras se revisa la operacion.',
    };
  }

  if (settings.stored.sendMode === 'live') {
    return {
      label: 'Operando',
      tone: 'success',
      description:
        'Las encuestas pueden operar con las reglas almacenadas y el rollout vigente.',
    };
  }

  return {
    label: 'Modo seguro',
    tone: 'neutral',
    description:
      'El envio permanece en mock, por lo que no se generan envios reales.',
  };
}

export function getSurveyRuntimeUpdatedByLabel(
  settings: SurveyRuntimeSettings,
  latestActor?: SurveyRuntimeSettingHistoryItem['actor'] | null,
): string {
  if (latestActor?.displayName) {
    return latestActor.displayName;
  }

  if (latestActor?.username) {
    return latestActor.username;
  }

  if (settings.metadata.lastUpdatedByAdminUserId) {
    return `Administrador #${settings.metadata.lastUpdatedByAdminUserId}`;
  }

  return 'Sistema';
}

export function getSurveyRuntimeFieldValue(
  snapshot: SurveyRuntimeSettings['stored'],
  key: SurveyRuntimeSettingKeyValue,
): string {
  return String(snapshot[key]);
}
