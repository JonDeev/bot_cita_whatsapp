import type { SurveyRuntimeSection } from '@whatsapp-bot/shared';
import type {
  SatisfactionSurveyRuntimeSettingChangeType,
  SatisfactionSurveyRuntimeSettingEventRecord,
  SatisfactionSurveyRuntimeSettingsRecord,
  SatisfactionSurveyRuntimeSettingsSnapshot,
} from '../satisfaction-survey-runtime.types';

export interface ListSatisfactionSurveyRuntimeSettingEventsInput {
  limit: number;
}

export interface SaveSatisfactionSurveyRuntimeSettingsCommand {
  scopeKey: string;
  expectedVersion: number;
  nextSnapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  effectiveSnapshot: SatisfactionSurveyRuntimeSettingsSnapshot;
  adminUserId: number | null;
  changeType: SatisfactionSurveyRuntimeSettingChangeType;
  section: SurveyRuntimeSection;
  reason: string | null;
  occurredAtIso: string;
  adminAudit: {
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, string | number | boolean | null>;
    ipHash: string | null;
  };
}

export interface SaveSatisfactionSurveyRuntimeSettingsResult {
  settings: SatisfactionSurveyRuntimeSettingsRecord;
  event: SatisfactionSurveyRuntimeSettingEventRecord;
}

export interface SatisfactionSurveyRuntimeSettingsRepository {
  findByScope(
    scopeKey: string,
  ): Promise<SatisfactionSurveyRuntimeSettingsRecord | null>;
  listEvents(
    input: ListSatisfactionSurveyRuntimeSettingEventsInput,
  ): Promise<SatisfactionSurveyRuntimeSettingEventRecord[]>;
  findLatestEventByChangeTypes(input: {
    changeTypes: readonly SatisfactionSurveyRuntimeSettingChangeType[];
  }): Promise<SatisfactionSurveyRuntimeSettingEventRecord | null>;
  saveWithEvent(
    command: SaveSatisfactionSurveyRuntimeSettingsCommand,
  ): Promise<SaveSatisfactionSurveyRuntimeSettingsResult | null>;
}
