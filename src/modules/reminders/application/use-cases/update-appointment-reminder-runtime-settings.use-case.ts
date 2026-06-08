import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AdminRole,
  ReminderRuntimeSettingKey,
  ReminderRuntimeSettingsDto,
  ReminderRuntimeSettingsUpdateRequestDto,
} from '@whatsapp-bot/shared';
import {
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderRuntimeSettingsRepository } from '../../domain/ports/appointment-reminder-runtime-settings.repository';
import {
  APPOINTMENT_REMINDER_RUNTIME_HOT_RELOADABLE_FIELDS,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
  APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES,
  type AppointmentReminderRuntimeSettingsSnapshot,
} from '../../domain/appointment-reminder-runtime.types';
import { AppointmentReminderRuntimeSettingsCatalogService } from '../services/appointment-reminder-runtime-settings-catalog.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';

@Injectable()
export class UpdateAppointmentReminderRuntimeSettingsUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: AppointmentReminderRuntimeSettingsRepository,
    private readonly catalog: AppointmentReminderRuntimeSettingsCatalogService,
    private readonly resolver: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    request: ReminderRuntimeSettingsUpdateRequestDto;
  }): Promise<ReminderRuntimeSettingsDto> {
    const currentRecord = await this.resolver.getStoredRecord();
    const currentSnapshot =
      currentRecord?.snapshot ?? (await this.resolver.resolveStoredSnapshot());

    const changeEntries = Object.entries(input.request.changes) as Array<
      [ReminderRuntimeSettingKey, string]
    >;

    const changedKeys = changeEntries
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    if (changedKeys.length === 0) {
      throw new BadRequestException('At least one settings change is required.');
    }

    for (const key of changedKeys) {
      if (!this.catalog.isEditableByRole(key, input.adminRole)) {
        throw new ForbiddenException(
          `Role ${input.adminRole} cannot update reminder runtime field ${key}.`,
        );
      }
    }

    const requiresReason = changedKeys.some((key) =>
      this.catalog.requiresReason(key),
    );
    const reason = input.request.reason?.trim() || null;
    if (requiresReason && !reason) {
      throw new BadRequestException(
        'A reason is required for protected reminder runtime changes.',
      );
    }

    const nextSnapshot = this.catalog.toDomainSnapshot({
      ...this.catalog.toDtoSnapshot(currentSnapshot),
      ...input.request.changes,
    });

    this.validateInvariants(nextSnapshot);

    const effectiveSnapshot = this.buildEffectiveSnapshot(
      currentSnapshot,
      nextSnapshot,
    );

    const changedSections = new Set(
      changedKeys.map((key) => this.catalog.getFieldSection(key)),
    );
    const section = changedSections.has('protected')
      ? 'protected'
      : changedSections.has('advanced')
        ? 'advanced'
        : 'primary';

    const saved = await this.repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: input.request.expectedVersion,
      nextSnapshot,
      effectiveSnapshot,
      adminUserId: input.adminUserId,
      changeType: APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.SETTINGS_UPDATED,
      section,
      reason,
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: 'admin.reminder_runtime_settings.updated',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          section,
          expectedVersion: input.request.expectedVersion,
          nextVersion: input.request.expectedVersion + 1,
          changedKeys: changedKeys.join(','),
        },
        ipHash: input.ipHash ?? null,
      },
    });

    if (!saved) {
      throw new ConflictException(
        'Reminder runtime settings were updated by another operator. Refresh and retry.',
      );
    }

    return this.resolverBuildResponse(input.adminRole, saved.settings);
  }

  private async resolverBuildResponse(
    role: AdminRole,
    settings: { version: number },
  ): Promise<ReminderRuntimeSettingsDto> {
    const response = await this.resolver.resolveRuntimeView();

    return {
      ...response,
      metadata: {
        ...response.metadata,
        version: settings.version,
      },
      permissions: {
        canEditPrimary: role === 'ADMIN' || role === 'SUPERVISOR',
        canEditAdvanced: role === 'ADMIN',
        canEditProtected: role === 'ADMIN',
        canToggleEmergencyPause: role === 'ADMIN' || role === 'SUPERVISOR',
      },
    };
  }

  private validateInvariants(
    snapshot: AppointmentReminderRuntimeSettingsSnapshot,
  ): void {
    if (snapshot.lockHeartbeatIntervalMs > snapshot.lockTtlSeconds * 1000) {
      throw new BadRequestException(
        'lockHeartbeatIntervalMs must be lower than or equal to lockTtlSeconds * 1000.',
      );
    }

    if (snapshot.dispatchBatchSize > snapshot.eligibilityLimit) {
      throw new BadRequestException(
        'dispatchBatchSize must be lower than or equal to eligibilityLimit.',
      );
    }

    if (snapshot.workerConcurrency < 1) {
      throw new BadRequestException(
        'workerConcurrency must be greater than or equal to 1.',
      );
    }
  }

  private buildEffectiveSnapshot(
    current: AppointmentReminderRuntimeSettingsSnapshot,
    next: AppointmentReminderRuntimeSettingsSnapshot,
  ): AppointmentReminderRuntimeSettingsSnapshot {
    return {
      ...current,
      sendMode: next.sendMode,
      sendRolloutPercent: next.sendRolloutPercent,
      emergencyPauseEnabled: next.emergencyPauseEnabled,
      dispatchBatchSize: next.dispatchBatchSize,
      eligibilityLimit: next.eligibilityLimit,
      lockTtlSeconds: next.lockTtlSeconds,
      lockHeartbeatIntervalMs: next.lockHeartbeatIntervalMs,
      minConfirmationHours: next.minConfirmationHours,
    };
  }
}
