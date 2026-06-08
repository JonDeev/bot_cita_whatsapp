import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  ReminderRuntimeSection,
  ReminderRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { AppointmentReminderRuntimeSettingsCatalogService } from '../../../reminders/application/services/appointment-reminder-runtime-settings-catalog.service';
import { ListAppointmentReminderRuntimeSettingEventsUseCase } from '../../../reminders/application/use-cases/list-appointment-reminder-runtime-setting-events.use-case';

export interface ListAdminReminderRuntimeSettingHistoryQuery {
  page: number;
  pageSize: number;
}

export interface AdminReminderRuntimeSettingHistoryItem {
  id: number;
  settingsVersion: number;
  changeType: string;
  section: ReminderRuntimeSection;
  reason: string | null;
  occurredAtIso: string;
  actor: {
    adminUserId: number | null;
    displayName: string | null;
    username: string | null;
  };
  previousSnapshot: ReminderRuntimeSettingsSnapshotDto;
  newSnapshot: ReminderRuntimeSettingsSnapshotDto;
  effectiveSnapshot: ReminderRuntimeSettingsSnapshotDto;
}

export interface AdminReminderRuntimeSettingHistoryResult {
  items: AdminReminderRuntimeSettingHistoryItem[];
  page: number;
  pageSize: number;
}

@Injectable()
export class ListAdminReminderRuntimeSettingHistoryUseCase {
  constructor(
    private readonly listHistory: ListAppointmentReminderRuntimeSettingEventsUseCase,
    private readonly catalog: AppointmentReminderRuntimeSettingsCatalogService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminReminderRuntimeSettingHistoryQuery,
  ): Promise<AdminReminderRuntimeSettingHistoryResult> {
    const limit = Math.min(query.page * query.pageSize, 100);
    const events = await this.listHistory.execute({ limit });
    const startIndex = (query.page - 1) * query.pageSize;
    const pagedItems = events.slice(startIndex, startIndex + query.pageSize);

    await this.audit.write({
      adminUserId,
      action: 'admin.reminders.settings_history_viewed',
      resourceType: 'appointment_reminder_runtime_settings',
      resourceId: 'default',
      metadata: {
        role,
        page: query.page,
        pageSize: query.pageSize,
      },
    });

    return {
      items: pagedItems.map((event) => ({
        id: event.id,
        settingsVersion: event.settingsVersion,
        changeType: event.changeType,
        section: event.section,
        reason: event.reason,
        occurredAtIso: event.occurredAtIso,
        actor: {
          adminUserId: event.adminUserId,
          displayName: event.actor.displayName,
          username: event.actor.username,
        },
        previousSnapshot: this.catalog.toDtoSnapshot(event.previousSnapshot),
        newSnapshot: this.catalog.toDtoSnapshot(event.newSnapshot),
        effectiveSnapshot: this.catalog.toDtoSnapshot(event.effectiveSnapshot),
      })),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
