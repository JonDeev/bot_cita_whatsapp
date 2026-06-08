import { Injectable } from '@nestjs/common';
import type { AdminRole, ReminderRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';

@Injectable()
export class GetAppointmentReminderRuntimeSettingsUseCase {
  constructor(
    private readonly resolver: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(role: AdminRole): Promise<ReminderRuntimeSettingsDto> {
    const view = await this.resolver.resolveRuntimeView();

    return {
      ...view,
      permissions: {
        canEditPrimary: role === 'ADMIN' || role === 'SUPERVISOR',
        canEditAdvanced: role === 'ADMIN',
        canEditProtected: role === 'ADMIN',
        canToggleEmergencyPause: role === 'ADMIN' || role === 'SUPERVISOR',
      },
    };
  }
}
