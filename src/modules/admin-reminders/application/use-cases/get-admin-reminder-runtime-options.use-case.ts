import { Injectable } from '@nestjs/common';
import type { ReminderRuntimeSettingsOptionsDto } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { GetAppointmentReminderRuntimeOptionsUseCase } from '../../../reminders/application/use-cases/get-appointment-reminder-runtime-options.use-case';

@Injectable()
export class GetAdminReminderRuntimeOptionsUseCase {
  constructor(
    private readonly getRuntimeOptions: GetAppointmentReminderRuntimeOptionsUseCase,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number): Promise<ReminderRuntimeSettingsOptionsDto> {
    const result = this.getRuntimeOptions.execute();

    await this.audit.write({
      adminUserId,
      action: 'admin.reminders.settings_options_viewed',
      resourceType: 'appointment_reminder_runtime_settings',
      resourceId: 'default',
      metadata: {},
    });

    return result;
  }
}
