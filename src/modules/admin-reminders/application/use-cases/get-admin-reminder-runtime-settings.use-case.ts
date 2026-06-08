import { Injectable } from '@nestjs/common';
import type { AdminRole, ReminderRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { GetAppointmentReminderRuntimeSettingsUseCase } from '../../../reminders/application/use-cases/get-appointment-reminder-runtime-settings.use-case';

@Injectable()
export class GetAdminReminderRuntimeSettingsUseCase {
  constructor(
    private readonly getRuntimeSettings: GetAppointmentReminderRuntimeSettingsUseCase,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
  ): Promise<ReminderRuntimeSettingsDto> {
    const result = await this.getRuntimeSettings.execute(role);

    await this.audit.write({
      adminUserId,
      action: 'admin.reminders.settings_viewed',
      resourceType: 'appointment_reminder_runtime_settings',
      resourceId: 'default',
      metadata: {
        role,
        version: result.metadata.version,
      },
    });

    return result;
  }
}
