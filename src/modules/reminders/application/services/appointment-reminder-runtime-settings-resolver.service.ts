import { Inject, Injectable } from '@nestjs/common';
import type { ReminderRuntimeSettingKey, ReminderRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { AppointmentReminderBootstrapConfigService } from './appointment-reminder-bootstrap-config.service';
import { AppointmentReminderRuntimeSettingsCatalogService } from './appointment-reminder-runtime-settings-catalog.service';
import {
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderRuntimeSettingsRepository } from '../../domain/ports/appointment-reminder-runtime-settings.repository';
import {
  APPOINTMENT_REMINDER_RUNTIME_HOT_RELOADABLE_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
  type AppointmentReminderHotReloadableSettings,
  type AppointmentReminderRuntimeSettingsRecord,
  type AppointmentReminderRuntimeSettingsSnapshot,
} from '../../domain/appointment-reminder-runtime.types';

const RESTART_REQUIRED_NOTE =
  'Los campos protegidos de ciclo de vida quedan guardados de inmediato, pero requieren reinicio controlado para aplicar en schedulers o workers ya iniciados.';

@Injectable()
export class AppointmentReminderRuntimeSettingsResolverService {
  constructor(
    @Inject(APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: AppointmentReminderRuntimeSettingsRepository,
    private readonly bootstrap: AppointmentReminderBootstrapConfigService,
    private readonly catalog: AppointmentReminderRuntimeSettingsCatalogService,
  ) {}

  async getStoredRecord(): Promise<AppointmentReminderRuntimeSettingsRecord | null> {
    return this.repository.findByScope(
      APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
    );
  }

  async resolveStoredSnapshot(): Promise<AppointmentReminderRuntimeSettingsSnapshot> {
    const record = await this.getStoredRecord();
    return record?.snapshot ?? this.bootstrap.getRuntimeSettingsSnapshot();
  }

  async resolveEffectiveHotReloadableSettings(): Promise<AppointmentReminderHotReloadableSettings> {
    const stored = await this.resolveStoredSnapshot();
    const effective = { ...stored };

    if (effective.emergencyPauseEnabled) {
      effective.sendMode = 'live';
    }

    return this.pickHotReloadable(effective);
  }

  async resolveRuntimeView(): Promise<Omit<ReminderRuntimeSettingsDto, 'permissions'>> {
    const record = await this.getStoredRecord();
    const storedSnapshot =
      record?.snapshot ?? this.bootstrap.getRuntimeSettingsSnapshot();
    const effectiveHotReloadable =
      await this.resolveEffectiveHotReloadableSettings();
    const emergencyPauseReason = storedSnapshot.emergencyPauseEnabled
      ? await this.resolveActiveEmergencyPauseReason()
      : null;

    return {
      stored: this.catalog.toDtoSnapshot(storedSnapshot),
      effectiveHotReloadable:
        this.catalog.toDtoHotReloadableSettings(effectiveHotReloadable),
      metadata: {
        version: record?.version ?? 0,
        lastUpdatedAtIso:
          record?.updatedAtIso ?? new Date(0).toISOString(),
        lastUpdatedByAdminUserId: record?.updatedByAdminUserId ?? null,
        emergencyPauseReason,
      },
      runtimeApplication: {
        restartScopedFieldKeys: [...APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS],
        restartScopedApplyNote: RESTART_REQUIRED_NOTE,
      },
    };
  }

  async isEmergencyPauseActive(): Promise<boolean> {
    const effective = await this.resolveEffectiveHotReloadableSettings();
    return effective.emergencyPauseEnabled;
  }

  isWithinReminderSendRollout(
    patientLegacyUserId: number,
    sendRolloutPercent: number,
  ): boolean {
    if (sendRolloutPercent >= 100) {
      return true;
    }

    if (sendRolloutPercent <= 0) {
      return false;
    }

    const cohortBucket = Math.abs(Math.trunc(patientLegacyUserId)) % 100;
    return cohortBucket < sendRolloutPercent;
  }

  getRestartRequiredFieldKeys(): ReminderRuntimeSettingKey[] {
    return [...APPOINTMENT_REMINDER_RUNTIME_RESTART_SCOPED_FIELDS];
  }

  private pickHotReloadable(
    snapshot: AppointmentReminderRuntimeSettingsSnapshot,
  ): AppointmentReminderHotReloadableSettings {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: snapshot.sendRolloutPercent,
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled,
      dispatchBatchSize: snapshot.dispatchBatchSize,
      eligibilityLimit: snapshot.eligibilityLimit,
      lockTtlSeconds: snapshot.lockTtlSeconds,
      lockHeartbeatIntervalMs: snapshot.lockHeartbeatIntervalMs,
      minConfirmationHours: snapshot.minConfirmationHours,
    };
  }

  private async resolveActiveEmergencyPauseReason(): Promise<string | null> {
    const latestRelevantEvent =
      await this.repository.findLatestEventByChangeTypes({
        changeTypes: [
          APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
          APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
        ],
      });

    if (!latestRelevantEvent) {
      return null;
    }

    if (
      latestRelevantEvent.changeType ===
      APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED
    ) {
      return latestRelevantEvent.reason;
    }

    return null;
  }
}
