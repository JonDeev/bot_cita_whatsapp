import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  SurveyRuntimeApplyMode,
  SurveyRuntimeSection,
  SurveyRuntimeSettingFieldOptionDto,
  SurveyRuntimeSettingKey,
  SurveyRuntimeHotReloadableSettingsDto,
  SurveyRuntimeSettingsOptionsDto,
  SurveyRuntimeSettingsDto,
  SurveyRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';
import {
  SURVEY_ELIGIBILITY_LIMIT_VALUES,
  SURVEY_EXPIRATION_HOURS_VALUES,
  SURVEY_MAX_DISPATCHES_PER_RUN_VALUES,
  SURVEY_RUNTIME_ADVANCED_SETTING_KEYS,
  SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS,
  SURVEY_RUNTIME_PRIMARY_SETTING_KEYS,
  SURVEY_RUNTIME_PROTECTED_SETTING_KEYS,
  SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS,
  SURVEY_RUNTIME_SCHEDULE_PROFILES,
  SURVEY_SEND_ROLLOUT_PERCENT_VALUES,
  SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES,
  SURVEY_TICK_INTERVAL_MS_VALUES,
} from '@whatsapp-bot/shared';
import type {
  SatisfactionSurveyRuntimeFieldDefinition,
  SatisfactionSurveyRuntimeHotReloadableSettings,
  SatisfactionSurveyRuntimeSettingsSnapshot,
} from '../../domain/satisfaction-survey-runtime.types';

const ADMIN_AND_SUPERVISOR_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];
const ADMIN_ONLY_ROLES: AdminRole[] = ['ADMIN'];

type AllowedValue<K extends SurveyRuntimeSettingKey> =
  SurveyRuntimeSettingsSnapshotDto[K];

interface CatalogValue<K extends SurveyRuntimeSettingKey> {
  dtoValue: AllowedValue<K>;
  domainValue: SatisfactionSurveyRuntimeSettingsSnapshot[K];
  label: string;
}

interface CatalogEntry<K extends SurveyRuntimeSettingKey>
  extends Omit<
    SatisfactionSurveyRuntimeFieldDefinition<K>,
    'dtoAllowedValues' | 'domainAllowedValues'
  > {
  allowedValues: readonly CatalogValue<SurveyRuntimeSettingKey>[];
}

@Injectable()
export class SatisfactionSurveyRuntimeSettingsCatalogService {
  private readonly entries: {
    [K in SurveyRuntimeSettingKey]: CatalogEntry<K>;
  } = {
    sendMode: this.createEntry({
      key: 'sendMode',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: false,
      label: 'Modo de envio',
      description:
        'Define si las encuestas saldrán como mensajes reales o como ejecución de control.',
      warningText:
        'Cambiar a live habilita envíos reales hacia pacientes elegibles.',
      allowedValues: [
        { dtoValue: 'mock', domainValue: 'mock', label: 'Mock' },
        { dtoValue: 'live', domainValue: 'live', label: 'Live' },
      ],
    }),
    sendRolloutPercent: this.createEntry({
      key: 'sendRolloutPercent',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: false,
      label: 'Porcentaje de rollout',
      description:
        'Limita qué porcentaje de pacientes elegibles recibe envío real.',
      warningText:
        'Usa un rollout bajo al activar live por primera vez.',
      allowedValues: [
        { dtoValue: '0', domainValue: 0, label: '0%' },
        { dtoValue: '5', domainValue: 5, label: '5%' },
        { dtoValue: '10', domainValue: 10, label: '10%' },
        { dtoValue: '25', domainValue: 25, label: '25%' },
        { dtoValue: '50', domainValue: 50, label: '50%' },
        { dtoValue: '75', domainValue: 75, label: '75%' },
        { dtoValue: '100', domainValue: 100, label: '100%' },
      ],
    }),
    emergencyPauseEnabled: this.createEntry({
      key: 'emergencyPauseEnabled',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: true,
      label: 'Pausa de emergencia',
      description:
        'Detiene envíos reales sin modificar la configuración guardada ni la experiencia del paciente.',
      warningText:
        'Úsala solo para incidentes, mantenimiento o revisión operativa crítica.',
      allowedValues: [
        { dtoValue: 'enabled', domainValue: true, label: 'Habilitada' },
        { dtoValue: 'disabled', domainValue: false, label: 'Deshabilitada' },
      ],
    }),
    dispatchEnabled: this.createEntry({
      key: 'dispatchEnabled',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Despacho habilitado',
      description:
        'Permite crear y procesar despachos automáticos de encuestas.',
      warningText:
        'Desactivarlo detiene la creación de nuevos despachos.',
      allowedValues: [
        { dtoValue: 'enabled', domainValue: true, label: 'Habilitado' },
        { dtoValue: 'disabled', domainValue: false, label: 'Deshabilitado' },
      ],
    }),
    eligibilityLimit: this.createEntry({
      key: 'eligibilityLimit',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Límite de elegibilidad',
      description:
        'Controla cuántas citas candidatas se consideran por corrida.',
      warningText:
        'Un límite muy bajo puede retrasar la puesta al día de despachos.',
      allowedValues: this.createNumericAllowedValues(
        SURVEY_ELIGIBILITY_LIMIT_VALUES,
        (value) => value,
      ),
    }),
    expirationHours: this.createEntry({
      key: 'expirationHours',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Vigencia del despacho',
      description:
        'Define durante cuántas horas un despacho permanece vigente antes de expirar.',
      warningText:
        'Una vigencia menor puede cerrar despachos demasiado pronto.',
      allowedValues: this.createNumericAllowedValues(
        SURVEY_EXPIRATION_HOURS_VALUES,
        (value) => `${value} h`,
      ),
    }),
    scheduleProfile: this.createEntry({
      key: 'scheduleProfile',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Perfil de horario',
      description:
        'Determina en qué días y franjas se ejecuta el lote automático.',
      warningText:
        'Cambiar este perfil modifica cuándo se evalúan nuevas ventanas.',
      allowedValues: [
        {
          dtoValue: 'business_hours_mon_fri',
          domainValue: 'business_hours_mon_fri',
          label: 'Horario laboral lun-vie',
        },
        {
          dtoValue: 'extended_hours_mon_fri',
          domainValue: 'extended_hours_mon_fri',
          label: 'Horario extendido lun-vie',
        },
        {
          dtoValue: 'business_hours_mon_sat',
          domainValue: 'business_hours_mon_sat',
          label: 'Horario laboral lun-sáb',
        },
      ],
    }),
    schedulerLoopEnabled: this.createEntry({
      key: 'schedulerLoopEnabled',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Bucle del scheduler',
      description:
        'Habilita el loop que dispara las corridas programadas del dispatcher.',
      warningText:
        'Requiere reinicio controlado para tomar efecto.',
      allowedValues: [
        { dtoValue: 'enabled', domainValue: true, label: 'Habilitado' },
        { dtoValue: 'disabled', domainValue: false, label: 'Deshabilitado' },
      ],
    }),
    tickIntervalMs: this.createEntry({
      key: 'tickIntervalMs',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Intervalo del loop',
      description:
        'Frecuencia de verificación del scheduler en milisegundos.',
      warningText:
        'Requiere reinicio controlado para aplicar el nuevo intervalo.',
      allowedValues: this.createNumericAllowedValues(
        SURVEY_TICK_INTERVAL_MS_VALUES,
        (value) => `${Number(value) / 1000} s`,
      ),
    }),
    slotLockTtlSeconds: this.createEntry({
      key: 'slotLockTtlSeconds',
      section: 'protected',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'TTL del lock',
      description:
        'Tiempo de vida del lock de corrida para evitar ejecuciones duplicadas.',
      warningText:
        'Un TTL demasiado bajo puede liberar locks antes de tiempo.',
      allowedValues: this.createNumericAllowedValues(
        SURVEY_SLOT_LOCK_TTL_SECONDS_VALUES,
        (value) => `${Number(value) / 60} min`,
      ),
    }),
    maxDispatchesPerRun: this.createEntry({
      key: 'maxDispatchesPerRun',
      section: 'protected',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Máximo por corrida',
      description:
        'Limita cuántos despachos procesa cada ejecución del lote.',
      warningText:
        'Reduce picos de carga si el volumen operativo aumenta.',
      allowedValues: this.createNumericAllowedValues(
        SURVEY_MAX_DISPATCHES_PER_RUN_VALUES,
        (value) => value,
      ),
    }),
  };

  getFieldDefinition<K extends SurveyRuntimeSettingKey>(
    key: K,
  ): SatisfactionSurveyRuntimeFieldDefinition<K> {
    return this.entries[key] as unknown as SatisfactionSurveyRuntimeFieldDefinition<K>;
  }

  getFieldSection(key: SurveyRuntimeSettingKey): SurveyRuntimeSection {
    return this.entries[key].section;
  }

  getFieldApplyMode(key: SurveyRuntimeSettingKey): SurveyRuntimeApplyMode {
    return this.entries[key].applyMode;
  }

  isEditableByRole(key: SurveyRuntimeSettingKey, role: AdminRole): boolean {
    return this.entries[key].editableByRoles.includes(role);
  }

  requiresReason(key: SurveyRuntimeSettingKey): boolean {
    return this.entries[key].requiresReason;
  }

  getOptions(): SurveyRuntimeSettingsOptionsDto {
    return {
      sections: {
        primary: this.buildSectionOptions(SURVEY_RUNTIME_PRIMARY_SETTING_KEYS),
        advanced: this.buildSectionOptions(SURVEY_RUNTIME_ADVANCED_SETTING_KEYS),
        protected: this.buildSectionOptions(SURVEY_RUNTIME_PROTECTED_SETTING_KEYS),
      },
    };
  }

  toDomainSnapshot(
    dto: SurveyRuntimeSettingsSnapshotDto,
  ): SatisfactionSurveyRuntimeSettingsSnapshot {
    return {
      sendMode: dto.sendMode,
      sendRolloutPercent: Number(dto.sendRolloutPercent),
      emergencyPauseEnabled: dto.emergencyPauseEnabled === 'enabled',
      dispatchEnabled: dto.dispatchEnabled === 'enabled',
      eligibilityLimit: Number(dto.eligibilityLimit),
      expirationHours: Number(dto.expirationHours),
      scheduleProfile: dto.scheduleProfile,
      schedulerLoopEnabled: dto.schedulerLoopEnabled === 'enabled',
      tickIntervalMs: Number(dto.tickIntervalMs),
      slotLockTtlSeconds: Number(dto.slotLockTtlSeconds),
      maxDispatchesPerRun: Number(dto.maxDispatchesPerRun),
    };
  }

  toDtoSnapshot(
    snapshot: SatisfactionSurveyRuntimeSettingsSnapshot,
  ): SurveyRuntimeSettingsSnapshotDto {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: String(snapshot.sendRolloutPercent) as SurveyRuntimeSettingsSnapshotDto['sendRolloutPercent'],
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled ? 'enabled' : 'disabled',
      dispatchEnabled: snapshot.dispatchEnabled ? 'enabled' : 'disabled',
      eligibilityLimit: String(snapshot.eligibilityLimit) as SurveyRuntimeSettingsSnapshotDto['eligibilityLimit'],
      expirationHours: String(snapshot.expirationHours) as SurveyRuntimeSettingsSnapshotDto['expirationHours'],
      scheduleProfile: snapshot.scheduleProfile,
      schedulerLoopEnabled: snapshot.schedulerLoopEnabled ? 'enabled' : 'disabled',
      tickIntervalMs: String(snapshot.tickIntervalMs) as SurveyRuntimeSettingsSnapshotDto['tickIntervalMs'],
      slotLockTtlSeconds: String(snapshot.slotLockTtlSeconds) as SurveyRuntimeSettingsSnapshotDto['slotLockTtlSeconds'],
      maxDispatchesPerRun: String(snapshot.maxDispatchesPerRun) as SurveyRuntimeSettingsSnapshotDto['maxDispatchesPerRun'],
    };
  }

  toDtoHotReloadableSettings(
    snapshot: SatisfactionSurveyRuntimeHotReloadableSettings,
  ): SurveyRuntimeHotReloadableSettingsDto {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: String(
        snapshot.sendRolloutPercent,
      ) as SurveyRuntimeHotReloadableSettingsDto['sendRolloutPercent'],
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled
        ? 'enabled'
        : 'disabled',
      dispatchEnabled: snapshot.dispatchEnabled ? 'enabled' : 'disabled',
      eligibilityLimit: String(
        snapshot.eligibilityLimit,
      ) as SurveyRuntimeHotReloadableSettingsDto['eligibilityLimit'],
      expirationHours: String(
        snapshot.expirationHours,
      ) as SurveyRuntimeHotReloadableSettingsDto['expirationHours'],
      scheduleProfile: snapshot.scheduleProfile,
      slotLockTtlSeconds: String(
        snapshot.slotLockTtlSeconds,
      ) as SurveyRuntimeHotReloadableSettingsDto['slotLockTtlSeconds'],
      maxDispatchesPerRun: String(
        snapshot.maxDispatchesPerRun,
      ) as SurveyRuntimeHotReloadableSettingsDto['maxDispatchesPerRun'],
    };
  }

  getHotReloadableFieldKeys(): readonly SurveyRuntimeSettingKey[] {
    return [...SURVEY_RUNTIME_HOT_RELOADABLE_SETTING_KEYS];
  }

  getRestartScopedFieldKeys(): readonly SurveyRuntimeSettingKey[] {
    return [...SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS];
  }

  getPermissionsForRole(
    adminRole: AdminRole,
  ): SurveyRuntimeSettingsDto['permissions'] {
    return {
      canEditPrimary: this.isEditableByRole('sendMode', adminRole),
      canEditAdvanced: this.isEditableByRole('dispatchEnabled', adminRole),
      canEditProtected: this.isEditableByRole(
        'schedulerLoopEnabled',
        adminRole,
      ),
      canToggleEmergencyPause: this.isEditableByRole(
        'emergencyPauseEnabled',
        adminRole,
      ),
    };
  }

  private buildSectionOptions(
    keys: readonly SurveyRuntimeSettingKey[],
  ): SurveyRuntimeSettingFieldOptionDto[] {
    return keys.map((key) => {
      const entry = this.entries[key];
      return {
        key,
        label: entry.label,
        description: entry.description,
        allowedValues: entry.allowedValues.map((value) => ({
          value: String(value.dtoValue),
          label: value.label,
        })),
        editableByRoles: [...entry.editableByRoles],
        warningText: entry.warningText,
        applyMode: entry.applyMode,
        requiresReason: entry.requiresReason,
      };
    });
  }

  private createEntry<K extends SurveyRuntimeSettingKey>(
    entry: CatalogEntry<K>,
  ): CatalogEntry<K> {
    return entry;
  }

  private createNumericAllowedValues(
    values: readonly string[],
    labelFormatter: (value: string) => string,
  ): readonly CatalogValue<SurveyRuntimeSettingKey>[] {
    return values.map((value) => ({
      dtoValue: value as SurveyRuntimeSettingsSnapshotDto[SurveyRuntimeSettingKey],
      domainValue: Number(value) as SatisfactionSurveyRuntimeSettingsSnapshot[SurveyRuntimeSettingKey],
      label: labelFormatter(value),
    }));
  }
}
