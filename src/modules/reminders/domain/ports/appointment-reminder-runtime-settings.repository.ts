import type { ReminderRuntimeSection } from '@whatsapp-bot/shared';
import type {
  AppointmentReminderRuntimeSettingChangeType,
  AppointmentReminderRuntimeSettingEventRecord,
  AppointmentReminderRuntimeSettingsRecord,
  AppointmentReminderRuntimeSettingsSnapshot,
} from '../appointment-reminder-runtime.types';

export interface ListAppointmentReminderRuntimeSettingEventsInput {
  limit: number;
}

export interface SaveAppointmentReminderRuntimeSettingsCommand {
  scopeKey: string;
  expectedVersion: number;
  nextSnapshot: AppointmentReminderRuntimeSettingsSnapshot;
  effectiveSnapshot: AppointmentReminderRuntimeSettingsSnapshot;
  adminUserId: number | null;
  changeType: AppointmentReminderRuntimeSettingChangeType;
  section: ReminderRuntimeSection;
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

export interface SaveAppointmentReminderRuntimeSettingsResult {
  settings: AppointmentReminderRuntimeSettingsRecord;
  event: AppointmentReminderRuntimeSettingEventRecord;
}

export interface AppointmentReminderRuntimeSettingsRepository {
  findByScope(
    scopeKey: string,
  ): Promise<AppointmentReminderRuntimeSettingsRecord | null>;
  listEvents(
    input: ListAppointmentReminderRuntimeSettingEventsInput,
  ): Promise<AppointmentReminderRuntimeSettingEventRecord[]>;
  findLatestEventByChangeTypes(input: {
    changeTypes: readonly AppointmentReminderRuntimeSettingChangeType[];
  }): Promise<AppointmentReminderRuntimeSettingEventRecord | null>;
  saveWithEvent(
    command: SaveAppointmentReminderRuntimeSettingsCommand,
  ): Promise<SaveAppointmentReminderRuntimeSettingsResult | null>;
}
