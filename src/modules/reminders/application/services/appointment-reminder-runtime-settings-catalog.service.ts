import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  ReminderRuntimeHotReloadableSettingsDto,
  ReminderRuntimeSection,
  ReminderRuntimeSettingFieldOptionDto,
  ReminderRuntimeSettingKey,
  ReminderRuntimeSettingsOptionsDto,
  ReminderRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';
import {
  APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES,
  APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS,
  APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES,
  APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES,
  APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES,
  APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS,
  APPOINTMENT_REMINDER_RUNTIME_ADVANCED_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_HOT_RELOADABLE_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_PRIMARY_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_PROTECTED_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS,
  APPOINTMENT_REMINDER_SEND_MODES,
  APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS,
  APPOINTMENT_REMINDER_SYNC_INTERVALS_MS,
  APPOINTMENT_REMINDER_WORKER_CONCURRENCIES,
  type AppointmentReminderHotReloadableSettings,
  type AppointmentReminderRuntimeFieldDefinition,
  type AppointmentReminderRuntimeSettingsSnapshot,
} from '../../domain/appointment-reminder-runtime.types';

const ADMIN_AND_SUPERVISOR_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];
const ADMIN_ONLY_ROLES: AdminRole[] = ['ADMIN'];

type BooleanSettingKey =
  | 'emergencyPauseEnabled'
  | 'syncEnabled'
  | 'dispatchEnabled'
  | 'queueEnabled';

interface CatalogValue<K extends ReminderRuntimeSettingKey> {
  dtoValue: ReminderRuntimeSettingsSnapshotDto[K];
  domainValue: AppointmentReminderRuntimeSettingsSnapshot[K];
  label: string;
}

interface CatalogEntry<K extends ReminderRuntimeSettingKey>
  extends Omit<
    AppointmentReminderRuntimeFieldDefinition<K>,
    'dtoAllowedValues' | 'domainAllowedValues'
  > {
  allowedValues: readonly CatalogValue<K>[];
}

@Injectable()
export class AppointmentReminderRuntimeSettingsCatalogService {
  private readonly entries: {
    [K in ReminderRuntimeSettingKey]: CatalogEntry<K>;
  } = {
    sendMode: this.createEntry({
      key: 'sendMode',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: false,
      label: 'Modo de envio',
      description:
        'Define si los recordatorios salen por WhatsApp Cloud API o quedan en modo operativo de prueba.',
      warningText:
        'Cambiar a live habilita envios reales para los pacientes elegibles.',
      allowedValues: [
        {
          dtoValue: APPOINTMENT_REMINDER_SEND_MODES.MOCK,
          domainValue: APPOINTMENT_REMINDER_SEND_MODES.MOCK,
          label: 'Mock',
        },
        {
          dtoValue: APPOINTMENT_REMINDER_SEND_MODES.LIVE,
          domainValue: APPOINTMENT_REMINDER_SEND_MODES.LIVE,
          label: 'Live',
        },
      ],
    }),
    sendRolloutPercent: this.createNumericEntry({
      key: 'sendRolloutPercent',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: false,
      label: 'Porcentaje de rollout',
      description:
        'Limita que porcentaje de pacientes elegibles puede recibir envios reales.',
      warningText: null,
      values: APPOINTMENT_REMINDER_SEND_ROLLOUT_PERCENTS,
      labelFormatter: (value) => `${value}%`,
    }),
    emergencyPauseEnabled: this.createBooleanEntry({
      key: 'emergencyPauseEnabled',
      section: 'primary',
      applyMode: 'immediate',
      editableByRoles: ADMIN_AND_SUPERVISOR_ROLES,
      requiresReason: true,
      label: 'Pausa de emergencia',
      description:
        'Congela los envios salientes sin marcar los despachos como enviados o descartados.',
      warningText:
        'Debe usarse solo para detener envios reales mientras se revisa un incidente.',
    }),
    dispatchBatchSize: this.createNumericEntry({
      key: 'dispatchBatchSize',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: false,
      label: 'Tamano de lote',
      description:
        'Controla cuantos recordatorios se procesan por corrida de despacho.',
      warningText:
        'Aumentar este valor puede elevar la carga operativa y la tasa de envios simultaneos.',
      values: APPOINTMENT_REMINDER_DISPATCH_BATCH_SIZES,
    }),
    eligibilityLimit: this.createNumericEntry({
      key: 'eligibilityLimit',
      section: 'advanced',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: false,
      label: 'Limite de elegibilidad',
      description:
        'Acota cuantas citas elegibles se consultan en cada barrido operativo.',
      warningText:
        'Un limite bajo puede retrasar la puesta al dia de despachos pendientes.',
      values: APPOINTMENT_REMINDER_ELIGIBILITY_LIMITS,
    }),
    syncEnabled: this.createBooleanEntry({
      key: 'syncEnabled',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Sincronizacion habilitada',
      description:
        'Permite iniciar el scheduler que crea o refresca recordatorios desde la agenda clinica.',
      warningText:
        'Requiere reinicio controlado para que el scheduler adopte el nuevo estado.',
    }),
    dispatchEnabled: this.createBooleanEntry({
      key: 'dispatchEnabled',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Despacho habilitado',
      description:
        'Permite iniciar el scheduler encargado de reclamar y enviar recordatorios pendientes.',
      warningText:
        'Requiere reinicio controlado para evitar estados mezclados del scheduler.',
    }),
    queueEnabled: this.createBooleanEntry({
      key: 'queueEnabled',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Cola habilitada',
      description:
        'Controla si el worker BullMQ puede recibir y ejecutar trabajos de despacho.',
      warningText:
        'Deshabilitar la cola sin coordinacion puede dejar recordatorios pendientes en espera.',
    }),
    syncIntervalMs: this.createNumericEntry({
      key: 'syncIntervalMs',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Intervalo de sincronizacion',
      description:
        'Frecuencia con la que se revisa la agenda para crear o refrescar recordatorios.',
      warningText:
        'Requiere reinicio controlado porque cambia el ciclo de vida del scheduler.',
      values: APPOINTMENT_REMINDER_SYNC_INTERVALS_MS,
      labelFormatter: (value) => `${value / 60_000} min`,
    }),
    recoverySweepIntervalMs: this.createNumericEntry({
      key: 'recoverySweepIntervalMs',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Intervalo de recuperacion',
      description:
        'Frecuencia con la que el sistema revisa locks y despachos para recuperacion segura.',
      warningText:
        'Requiere reinicio controlado porque el worker toma este valor al iniciar.',
      values: APPOINTMENT_REMINDER_RECOVERY_SWEEP_INTERVALS_MS,
      labelFormatter: (value) => `${value / 60_000} min`,
    }),
    workerConcurrency: this.createNumericEntry({
      key: 'workerConcurrency',
      section: 'protected',
      applyMode: 'restart_required',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Concurrencia del worker',
      description:
        'Cantidad de trabajos de despacho que el worker puede procesar en paralelo.',
      warningText:
        'Subir la concurrencia cambia el perfil de carga y requiere reinicio controlado.',
      values: APPOINTMENT_REMINDER_WORKER_CONCURRENCIES,
    }),
    lockTtlSeconds: this.createNumericEntry({
      key: 'lockTtlSeconds',
      section: 'protected',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'TTL del lock',
      description:
        'Tiempo maximo que un lock de despacho puede mantenerse antes de considerarse recuperable.',
      warningText:
        'Valores bajos aumentan recuperaciones prematuras; valores altos retrasan la recuperacion.',
      values: APPOINTMENT_REMINDER_LOCK_TTL_SECONDS_VALUES,
      labelFormatter: (value) => `${value} s`,
    }),
    lockHeartbeatIntervalMs: this.createNumericEntry({
      key: 'lockHeartbeatIntervalMs',
      section: 'protected',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Heartbeat del lock',
      description:
        'Intervalo con el que se renueva el lock de un despacho en procesamiento.',
      warningText:
        'Debe mantenerse coordinado con el TTL del lock para evitar perdida de ownership.',
      values: APPOINTMENT_REMINDER_LOCK_HEARTBEAT_INTERVAL_MS_VALUES,
      labelFormatter: (value) => `${value / 1000} s`,
    }),
    minConfirmationHours: this.createNumericEntry({
      key: 'minConfirmationHours',
      section: 'protected',
      applyMode: 'immediate',
      editableByRoles: ADMIN_ONLY_ROLES,
      requiresReason: true,
      label: 'Horas minimas de confirmacion',
      description:
        'Guardrail que evita enviar recordatorios demasiado cerca de la cita.',
      warningText:
        'Reducir este valor puede incrementar recordatorios tardios o clinicamente irrelevantes.',
      values: APPOINTMENT_REMINDER_MIN_CONFIRMATION_HOURS_VALUES,
      labelFormatter: (value) => `${value} h`,
    }),
  };

  getFieldDefinition<K extends ReminderRuntimeSettingKey>(
    key: K,
  ): AppointmentReminderRuntimeFieldDefinition<K> {
    const entry = this.entries[key];

    return {
      key: entry.key,
      section: entry.section,
      applyMode: entry.applyMode,
      editableByRoles: [...entry.editableByRoles],
      requiresReason: entry.requiresReason,
      label: entry.label,
      description: entry.description,
      warningText: entry.warningText,
      dtoAllowedValues: entry.allowedValues.map((value) => value.dtoValue),
      domainAllowedValues: entry.allowedValues.map((value) => value.domainValue),
    };
  }

  getFieldSection(key: ReminderRuntimeSettingKey): ReminderRuntimeSection {
    return this.entries[key].section;
  }

  isEditableByRole(key: ReminderRuntimeSettingKey, role: AdminRole): boolean {
    return this.entries[key].editableByRoles.includes(role);
  }

  requiresReason(key: ReminderRuntimeSettingKey): boolean {
    return this.entries[key].requiresReason;
  }

  getOptions(): ReminderRuntimeSettingsOptionsDto {
    return {
      sections: {
        primary: this.mapKeysToOptions(APPOINTMENT_REMINDER_RUNTIME_PRIMARY_FIELDS),
        advanced: this.mapKeysToOptions(
          APPOINTMENT_REMINDER_RUNTIME_ADVANCED_FIELDS,
        ),
        protected: this.mapKeysToOptions(
          APPOINTMENT_REMINDER_RUNTIME_PROTECTED_FIELDS,
        ),
      },
    };
  }

  getHotReloadableFieldKeys(): ReminderRuntimeSettingKey[] {
    return [...APPOINTMENT_REMINDER_RUNTIME_HOT_RELOADABLE_FIELDS];
  }

  getRestartScopedFieldKeys(): ReminderRuntimeSettingKey[] {
    return [...APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS];
  }

  canEditField(key: ReminderRuntimeSettingKey, role: AdminRole): boolean {
    return this.entries[key].editableByRoles.includes(role);
  }

  toDomainSnapshot(
    dto: ReminderRuntimeSettingsSnapshotDto,
  ): AppointmentReminderRuntimeSettingsSnapshot {
    return {
      sendMode: this.parseDtoValue('sendMode', dto.sendMode),
      sendRolloutPercent: this.parseDtoValue(
        'sendRolloutPercent',
        dto.sendRolloutPercent,
      ),
      emergencyPauseEnabled: this.parseDtoValue(
        'emergencyPauseEnabled',
        dto.emergencyPauseEnabled,
      ),
      dispatchBatchSize: this.parseDtoValue(
        'dispatchBatchSize',
        dto.dispatchBatchSize,
      ),
      eligibilityLimit: this.parseDtoValue(
        'eligibilityLimit',
        dto.eligibilityLimit,
      ),
      syncEnabled: this.parseDtoValue('syncEnabled', dto.syncEnabled),
      dispatchEnabled: this.parseDtoValue(
        'dispatchEnabled',
        dto.dispatchEnabled,
      ),
      queueEnabled: this.parseDtoValue('queueEnabled', dto.queueEnabled),
      syncIntervalMs: this.parseDtoValue('syncIntervalMs', dto.syncIntervalMs),
      recoverySweepIntervalMs: this.parseDtoValue(
        'recoverySweepIntervalMs',
        dto.recoverySweepIntervalMs,
      ),
      workerConcurrency: this.parseDtoValue(
        'workerConcurrency',
        dto.workerConcurrency,
      ),
      lockTtlSeconds: this.parseDtoValue(
        'lockTtlSeconds',
        dto.lockTtlSeconds,
      ),
      lockHeartbeatIntervalMs: this.parseDtoValue(
        'lockHeartbeatIntervalMs',
        dto.lockHeartbeatIntervalMs,
      ),
      minConfirmationHours: this.parseDtoValue(
        'minConfirmationHours',
        dto.minConfirmationHours,
      ),
    };
  }

  toDtoSnapshot(
    snapshot: AppointmentReminderRuntimeSettingsSnapshot,
  ): ReminderRuntimeSettingsSnapshotDto {
    return {
      sendMode: this.serializeDomainValue('sendMode', snapshot.sendMode),
      sendRolloutPercent: this.serializeDomainValue(
        'sendRolloutPercent',
        snapshot.sendRolloutPercent,
      ),
      emergencyPauseEnabled: this.serializeDomainValue(
        'emergencyPauseEnabled',
        snapshot.emergencyPauseEnabled,
      ),
      dispatchBatchSize: this.serializeDomainValue(
        'dispatchBatchSize',
        snapshot.dispatchBatchSize,
      ),
      eligibilityLimit: this.serializeDomainValue(
        'eligibilityLimit',
        snapshot.eligibilityLimit,
      ),
      syncEnabled: this.serializeDomainValue(
        'syncEnabled',
        snapshot.syncEnabled,
      ),
      dispatchEnabled: this.serializeDomainValue(
        'dispatchEnabled',
        snapshot.dispatchEnabled,
      ),
      queueEnabled: this.serializeDomainValue(
        'queueEnabled',
        snapshot.queueEnabled,
      ),
      syncIntervalMs: this.serializeDomainValue(
        'syncIntervalMs',
        snapshot.syncIntervalMs,
      ),
      recoverySweepIntervalMs: this.serializeDomainValue(
        'recoverySweepIntervalMs',
        snapshot.recoverySweepIntervalMs,
      ),
      workerConcurrency: this.serializeDomainValue(
        'workerConcurrency',
        snapshot.workerConcurrency,
      ),
      lockTtlSeconds: this.serializeDomainValue(
        'lockTtlSeconds',
        snapshot.lockTtlSeconds,
      ),
      lockHeartbeatIntervalMs: this.serializeDomainValue(
        'lockHeartbeatIntervalMs',
        snapshot.lockHeartbeatIntervalMs,
      ),
      minConfirmationHours: this.serializeDomainValue(
        'minConfirmationHours',
        snapshot.minConfirmationHours,
      ),
    };
  }

  toDtoHotReloadableSettings(
    snapshot: AppointmentReminderHotReloadableSettings,
  ): ReminderRuntimeHotReloadableSettingsDto {
    return {
      sendMode: this.serializeDomainValue('sendMode', snapshot.sendMode),
      sendRolloutPercent: this.serializeDomainValue(
        'sendRolloutPercent',
        snapshot.sendRolloutPercent,
      ),
      emergencyPauseEnabled: this.serializeDomainValue(
        'emergencyPauseEnabled',
        snapshot.emergencyPauseEnabled,
      ),
      dispatchBatchSize: this.serializeDomainValue(
        'dispatchBatchSize',
        snapshot.dispatchBatchSize,
      ),
      eligibilityLimit: this.serializeDomainValue(
        'eligibilityLimit',
        snapshot.eligibilityLimit,
      ),
      lockTtlSeconds: this.serializeDomainValue(
        'lockTtlSeconds',
        snapshot.lockTtlSeconds,
      ),
      lockHeartbeatIntervalMs: this.serializeDomainValue(
        'lockHeartbeatIntervalMs',
        snapshot.lockHeartbeatIntervalMs,
      ),
      minConfirmationHours: this.serializeDomainValue(
        'minConfirmationHours',
        snapshot.minConfirmationHours,
      ),
    };
  }

  private mapKeysToOptions(
    keys: readonly ReminderRuntimeSettingKey[],
  ): ReminderRuntimeSettingFieldOptionDto[] {
    return keys.map((key) => {
      const entry = this.entries[key];

      return {
        key: entry.key,
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

  private parseDtoValue<K extends ReminderRuntimeSettingKey>(
    key: K,
    dtoValue: ReminderRuntimeSettingsSnapshotDto[K],
  ): AppointmentReminderRuntimeSettingsSnapshot[K] {
    const match = this.entries[key].allowedValues.find(
      (value) => value.dtoValue === dtoValue,
    );
    if (!match) {
      throw new Error(`Unsupported reminder runtime dto value for ${key}.`);
    }

    return match.domainValue;
  }

  private serializeDomainValue<K extends ReminderRuntimeSettingKey>(
    key: K,
    domainValue: AppointmentReminderRuntimeSettingsSnapshot[K],
  ): ReminderRuntimeSettingsSnapshotDto[K] {
    const match = this.entries[key].allowedValues.find(
      (value) => value.domainValue === domainValue,
    );
    if (!match) {
      throw new Error(`Unsupported reminder runtime domain value for ${key}.`);
    }

    return match.dtoValue;
  }

  private createEntry<K extends ReminderRuntimeSettingKey>(
    input: CatalogEntry<K>,
  ): CatalogEntry<K> {
    return input;
  }

  private createBooleanEntry<K extends BooleanSettingKey>(input: {
    key: K;
    section: ReminderRuntimeSection;
    applyMode: 'immediate' | 'restart_required';
    editableByRoles: AdminRole[];
    requiresReason: boolean;
    label: string;
    description: string;
    warningText: string | null;
  }): CatalogEntry<K> {
    return this.createEntry({
      ...input,
      allowedValues: [
        {
          dtoValue: 'enabled',
          domainValue: true,
          label: 'Habilitado',
        },
        {
          dtoValue: 'disabled',
          domainValue: false,
          label: 'Deshabilitado',
        },
      ],
    });
  }

  private createNumericEntry<
    K extends Exclude<ReminderRuntimeSettingKey, BooleanSettingKey | 'sendMode'>,
  >(input: {
    key: K;
    section: ReminderRuntimeSection;
    applyMode: 'immediate' | 'restart_required';
    editableByRoles: AdminRole[];
    requiresReason: boolean;
    label: string;
    description: string;
    warningText: string | null;
    values: readonly AppointmentReminderRuntimeSettingsSnapshot[K][];
    labelFormatter?: (
      value: AppointmentReminderRuntimeSettingsSnapshot[K],
    ) => string;
  }): CatalogEntry<K> {
    return this.createEntry({
      ...input,
      allowedValues: input.values.map((value) => ({
        dtoValue: String(value) as ReminderRuntimeSettingsSnapshotDto[K],
        domainValue: value,
        label: input.labelFormatter?.(value) ?? String(value),
      })),
    });
  }
}
