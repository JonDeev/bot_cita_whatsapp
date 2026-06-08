import { Injectable } from '@nestjs/common';
import type { AdminRole, ReminderRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { ToggleAppointmentReminderEmergencyPauseUseCase } from '../../../reminders/application/use-cases/toggle-appointment-reminder-emergency-pause.use-case';

@Injectable()
export class ToggleAdminReminderEmergencyPauseUseCase {
  constructor(
    private readonly toggleEmergencyPause: ToggleAppointmentReminderEmergencyPauseUseCase,
  ) {}

  execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    expectedVersion: number;
    reason: string;
    enabled: boolean;
  }): Promise<ReminderRuntimeSettingsDto> {
    return this.toggleEmergencyPause.execute({
      adminUserId: input.adminUserId,
      adminRole: input.adminRole,
      ipHash: input.ipHash,
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      emergencyPauseEnabled: input.enabled ? 'enabled' : 'disabled',
    });
  }
}
