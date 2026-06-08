import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AdminRole,
  ReminderBooleanSelectValue,
  ReminderRuntimeSettingsDto,
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
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';

@Injectable()
export class ToggleAppointmentReminderEmergencyPauseUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: AppointmentReminderRuntimeSettingsRepository,
    private readonly resolver: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    expectedVersion: number;
    reason: string;
    emergencyPauseEnabled: ReminderBooleanSelectValue;
  }): Promise<ReminderRuntimeSettingsDto> {
    if (input.adminRole !== 'ADMIN' && input.adminRole !== 'SUPERVISOR') {
      throw new ForbiddenException(
        'Only ADMIN or SUPERVISOR can toggle emergency pause.',
      );
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException(
        'A reason is required for emergency pause actions.',
      );
    }

    const currentRecord = await this.resolver.getStoredRecord();
    const currentSnapshot =
      currentRecord?.snapshot ?? (await this.resolver.resolveStoredSnapshot());
    const nextSnapshot: AppointmentReminderRuntimeSettingsSnapshot = {
      ...currentSnapshot,
      emergencyPauseEnabled: input.emergencyPauseEnabled === 'enabled',
    };
    const effectiveSnapshot: AppointmentReminderRuntimeSettingsSnapshot = {
      ...currentSnapshot,
      sendMode: nextSnapshot.sendMode,
      sendRolloutPercent: nextSnapshot.sendRolloutPercent,
      emergencyPauseEnabled: nextSnapshot.emergencyPauseEnabled,
      dispatchBatchSize: nextSnapshot.dispatchBatchSize,
      eligibilityLimit: nextSnapshot.eligibilityLimit,
      lockTtlSeconds: nextSnapshot.lockTtlSeconds,
      lockHeartbeatIntervalMs: nextSnapshot.lockHeartbeatIntervalMs,
      minConfirmationHours: nextSnapshot.minConfirmationHours,
    };

    const enabled = nextSnapshot.emergencyPauseEnabled;
    const saved = await this.repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: input.expectedVersion,
      nextSnapshot,
      effectiveSnapshot,
      adminUserId: input.adminUserId,
      changeType: enabled
        ? APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED
        : APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
      section: 'primary',
      reason,
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: enabled
          ? 'admin.reminder_runtime_settings.emergency_pause_enabled'
          : 'admin.reminder_runtime_settings.emergency_pause_disabled',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          expectedVersion: input.expectedVersion,
          nextVersion: input.expectedVersion + 1,
          emergencyPauseEnabled: enabled,
        },
        ipHash: input.ipHash ?? null,
      },
    });

    if (!saved) {
      throw new ConflictException(
        'Reminder runtime settings were updated by another operator. Refresh and retry.',
      );
    }

    const response = await this.resolver.resolveRuntimeView();

    return {
      ...response,
      permissions: {
        canEditPrimary: input.adminRole === 'ADMIN' || input.adminRole === 'SUPERVISOR',
        canEditAdvanced: input.adminRole === 'ADMIN',
        canEditProtected: input.adminRole === 'ADMIN',
        canToggleEmergencyPause: true,
      },
    };
  }
}
