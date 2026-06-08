import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderRuntimeSettingsRepository } from '../../domain/ports/appointment-reminder-runtime-settings.repository';

@Injectable()
export class ListAppointmentReminderRuntimeSettingEventsUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: AppointmentReminderRuntimeSettingsRepository,
  ) {}

  execute(input?: { limit?: number }) {
    return this.repository.listEvents({
      limit: Math.min(Math.max(input?.limit ?? 20, 1), 100),
    });
  }
}
