import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrRefreshAppointmentReminderDispatchesUseCase } from '../../application/use-cases/create-or-refresh-appointment-reminder-dispatches.use-case';
import { AppointmentReminderDispatchConfigService } from '../../application/services/appointment-reminder-dispatch-config.service';

@Injectable()
export class AppointmentReminderSyncScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AppointmentReminderSyncScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly syncUseCase: CreateOrRefreshAppointmentReminderDispatchesUseCase,
    private readonly configService: AppointmentReminderDispatchConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.configService.isSyncSchedulerEnabled()) {
      this.logger.log(
        'Appointment reminder synchronizer scheduler is disabled by configuration.',
      );
      return;
    }

    const intervalMs = this.configService.getSyncIntervalMs();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    this.logger.log(
      `Appointment reminder synchronizer started with interval ${intervalMs}ms.`,
    );

    void this.tick();
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.syncUseCase.execute();
      this.logger.log(
        `Reminder sync completed: scanned=${result.scanned} created=${result.created} refreshed=${result.refreshed} skippedInvalidPhone=${result.skippedInvalidPhone}.`,
      );
    } catch (error) {
      this.logger.error(
        'Reminder sync failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
