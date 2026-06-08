import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../domain/appointment-reminder-runtime.types';
import { APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY } from '../../domain/reminders.tokens';
import type { AppointmentReminderRuntimeSettingsRepository } from '../../domain/ports/appointment-reminder-runtime-settings.repository';
import { AppointmentReminderBootstrapConfigService } from './appointment-reminder-bootstrap-config.service';

@Injectable()
export class AppointmentReminderRuntimeSettingsInitializerService
  implements OnModuleInit
{
  private readonly logger = new Logger(
    AppointmentReminderRuntimeSettingsInitializerService.name,
  );

  constructor(
    @Inject(APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: AppointmentReminderRuntimeSettingsRepository,
    private readonly bootstrap: AppointmentReminderBootstrapConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.repository.findByScope(
      APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
    );

    if (existing) {
      return;
    }

    const snapshot = this.bootstrap.getRuntimeSettingsSnapshot();
    const seeded = await this.repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 0,
      nextSnapshot: snapshot,
      effectiveSnapshot: snapshot,
      adminUserId: null,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
      section: 'protected',
      reason: 'bootstrap',
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: 'system.reminder_runtime_settings.defaults_seeded',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          source: 'bootstrap',
          seededVersion: 1,
        },
        ipHash: null,
      },
    });

    if (!seeded) {
      this.logger.log(
        'Reminder runtime settings were seeded by another concurrent instance.',
      );
      return;
    }

    this.logger.log(
      `Seeded reminder runtime settings scope=${seeded.settings.scopeKey} version=${seeded.settings.version}.`,
    );
  }
}
