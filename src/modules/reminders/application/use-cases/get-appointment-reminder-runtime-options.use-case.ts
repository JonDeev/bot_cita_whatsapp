import { Injectable } from '@nestjs/common';
import type { ReminderRuntimeSettingsOptionsDto } from '@whatsapp-bot/shared';
import { AppointmentReminderRuntimeSettingsCatalogService } from '../services/appointment-reminder-runtime-settings-catalog.service';

@Injectable()
export class GetAppointmentReminderRuntimeOptionsUseCase {
  constructor(
    private readonly catalog: AppointmentReminderRuntimeSettingsCatalogService,
  ) {}

  execute(): ReminderRuntimeSettingsOptionsDto {
    return this.catalog.getOptions();
  }
}
