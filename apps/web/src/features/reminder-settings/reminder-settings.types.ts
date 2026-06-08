import type {
  ReminderRuntimeApplyMode,
  ReminderEmergencyPauseUpdateRequestDto,
  ReminderRuntimeSection,
  ReminderRuntimeSettingFieldOptionDto,
  ReminderRuntimeSettingKey,
  ReminderRuntimeSettingsDto,
  ReminderRuntimeSettingsOptionsDto,
  ReminderRuntimeSettingsUpdateRequestDto,
} from '@whatsapp-bot/shared';

export type ReminderRuntimeSettings = ReminderRuntimeSettingsDto;
export type ReminderRuntimeSettingsOptions = ReminderRuntimeSettingsOptionsDto;
export type ReminderRuntimeSettingsUpdateRequest =
  ReminderRuntimeSettingsUpdateRequestDto;
export type ReminderEmergencyPauseUpdateRequest =
  ReminderEmergencyPauseUpdateRequestDto;
export type ReminderRuntimeSettingOption = ReminderRuntimeSettingFieldOptionDto;
export type ReminderRuntimeSettingKeyValue = ReminderRuntimeSettingKey;
export type ReminderRuntimeSectionValue = ReminderRuntimeSection;
export type ReminderRuntimeApplyModeValue = ReminderRuntimeApplyMode;

export interface ReminderRuntimeSettingHistoryItem {
  id: number;
  settingsVersion: number;
  changeType: string;
  section: ReminderRuntimeSectionValue;
  reason: string | null;
  occurredAtIso: string;
  actor: {
    adminUserId: number | null;
    displayName: string | null;
    username: string | null;
  };
  previousSnapshot: ReminderRuntimeSettings['stored'];
  newSnapshot: ReminderRuntimeSettings['stored'];
  effectiveSnapshot: ReminderRuntimeSettings['stored'];
}

export interface ReminderRuntimeSettingHistoryResult {
  items: ReminderRuntimeSettingHistoryItem[];
  page: number;
  pageSize: number;
}

export function formatReminderRuntimeSectionLabel(
  section: ReminderRuntimeSectionValue,
): string {
  switch (section) {
    case 'primary':
      return 'Controles primarios';
    case 'advanced':
      return 'Configuracion avanzada';
    case 'protected':
      return 'Configuracion protegida';
    default:
      return section;
  }
}

export function formatReminderRuntimeApplyModeLabel(
  applyMode: ReminderRuntimeApplyModeValue,
): string {
  return applyMode === 'immediate'
    ? 'Aplica de inmediato'
    : 'Requiere reinicio controlado';
}

export function formatReminderRuntimeSendModeLabel(value: string): string {
  return value === 'live' ? 'Live' : 'Mock';
}

export function formatReminderRuntimeAllowedRolesLabel(
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

export function formatReminderRuntimeGlobalStateLabel(
  settings: ReminderRuntimeSettings,
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
        'La pausa de emergencia activa overridea el envio real mientras el incidente se revisa.',
    };
  }

  if (settings.stored.sendMode === 'live') {
    return {
      label: 'Operando',
      tone: 'success',
      description:
        'Los recordatorios pueden operar con las reglas almacenadas y el rollout vigente.',
    };
  }

  return {
    label: 'Modo seguro',
    tone: 'neutral',
    description:
      'El envio permanece en mock, por lo que no se generan recordatorios reales.',
  };
}

export function getReminderRuntimeFieldValue(
  snapshot: ReminderRuntimeSettings['stored'],
  key: ReminderRuntimeSettingKeyValue,
): string {
  return String(snapshot[key]);
}

export function getReminderRuntimeSectionAllowed(
  settings: ReminderRuntimeSettings,
  section: ReminderRuntimeSectionValue,
): boolean {
  if (section === 'primary') {
    return settings.permissions.canEditPrimary;
  }

  if (section === 'advanced') {
    return settings.permissions.canEditAdvanced;
  }

  return settings.permissions.canEditProtected;
}

export function getReminderRuntimeUpdatedByLabel(
  settings: ReminderRuntimeSettings,
  latestActor?: {
    adminUserId: number | null;
    displayName: string | null;
    username: string | null;
  } | null,
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
