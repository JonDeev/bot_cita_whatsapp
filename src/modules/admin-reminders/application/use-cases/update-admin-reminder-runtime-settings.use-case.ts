import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  ReminderRuntimeSettingsDto,
  ReminderRuntimeSettingsUpdateRequestDto,
} from '@whatsapp-bot/shared';
import { UpdateAppointmentReminderRuntimeSettingsUseCase } from '../../../reminders/application/use-cases/update-appointment-reminder-runtime-settings.use-case';

@Injectable()
export class UpdateAdminReminderRuntimeSettingsUseCase {
  constructor(
    private readonly updateRuntimeSettings: UpdateAppointmentReminderRuntimeSettingsUseCase,
  ) {}

  execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    request: ReminderRuntimeSettingsUpdateRequestDto;
  }): Promise<ReminderRuntimeSettingsDto> {
    return this.updateRuntimeSettings.execute(input);
  }
}
