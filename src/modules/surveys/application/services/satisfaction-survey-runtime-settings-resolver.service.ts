import { Inject, Injectable } from '@nestjs/common';
import type {
  SurveyRuntimeSettingsDto,
} from '@whatsapp-bot/shared';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/surveys.tokens';
import type { SatisfactionSurveyRuntimeSettingsRepository } from '../../domain/ports/satisfaction-survey-runtime-settings.repository';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES,
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
  type SatisfactionSurveyRuntimeHotReloadableSettings,
  type SatisfactionSurveyRuntimeSettingsRecord,
  type SatisfactionSurveyRuntimeSettingsSnapshot,
} from '../../domain/satisfaction-survey-runtime.types';
import { SatisfactionSurveyDispatchSchedulerConfigService } from '../../infrastructure/scheduling/satisfaction-survey-dispatch-scheduler-config.service';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from './satisfaction-survey-runtime-settings-catalog.service';

@Injectable()
export class SatisfactionSurveyRuntimeSettingsResolverService {
  constructor(
    @Inject(SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: SatisfactionSurveyRuntimeSettingsRepository,
    private readonly bootstrap: SatisfactionSurveyDispatchSchedulerConfigService,
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  async getStoredRecord(): Promise<SatisfactionSurveyRuntimeSettingsRecord | null> {
    return this.repository.findByScope(
      SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
    );
  }

  async resolveStoredSnapshot(): Promise<SatisfactionSurveyRuntimeSettingsSnapshot> {
    const record = await this.getStoredRecord();
    return record?.snapshot ?? this.bootstrap.getRuntimeSettingsSnapshot();
  }

  async resolveRuntimeView(): Promise<Omit<SurveyRuntimeSettingsDto, 'permissions'>> {
    const record = await this.getStoredRecord();
    const storedSnapshot =
      record?.snapshot ?? this.bootstrap.getRuntimeSettingsSnapshot();
    const effectiveHotReloadable = this.pickHotReloadable(storedSnapshot);
    const emergencyPauseReason = storedSnapshot.emergencyPauseEnabled
      ? await this.resolveActiveEmergencyPauseReason()
      : null;

    return {
      stored: this.catalog.toDtoSnapshot(storedSnapshot),
      effectiveHotReloadable:
        this.catalog.toDtoHotReloadableSettings(effectiveHotReloadable),
      metadata: {
        version: record?.version ?? 0,
        lastUpdatedAtIso: record?.updatedAtIso ?? new Date(0).toISOString(),
        lastUpdatedByAdminUserId: record?.updatedByAdminUserId ?? null,
        emergencyPauseReason,
      },
    };
  }

  async isEmergencyPauseActive(): Promise<boolean> {
    const stored = await this.resolveStoredSnapshot();
    return stored.emergencyPauseEnabled;
  }

  isWithinSendRollout(
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

  getRestartRequiredFieldKeys() {
    return this.catalog.getRestartScopedFieldKeys();
  }

  private pickHotReloadable(
    snapshot: SatisfactionSurveyRuntimeSettingsSnapshot,
  ): SatisfactionSurveyRuntimeHotReloadableSettings {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: snapshot.sendRolloutPercent,
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled,
      dispatchEnabled: snapshot.dispatchEnabled,
      eligibilityLimit: snapshot.eligibilityLimit,
      expirationHours: snapshot.expirationHours,
      scheduleProfile: snapshot.scheduleProfile,
      slotLockTtlSeconds: snapshot.slotLockTtlSeconds,
      maxDispatchesPerRun: snapshot.maxDispatchesPerRun,
    };
  }

  private async resolveActiveEmergencyPauseReason(): Promise<string | null> {
    const latestRelevantEvent =
      await this.repository.findLatestEventByChangeTypes({
        changeTypes: [
          SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
          SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
        ],
      });

    if (!latestRelevantEvent) {
      return null;
    }

    if (
      latestRelevantEvent.changeType ===
      SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED
    ) {
      return latestRelevantEvent.reason;
    }

    return null;
  }
}
