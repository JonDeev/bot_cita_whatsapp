import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppointmentReminderDispatchConfigService } from '../../application/services/appointment-reminder-dispatch-config.service';
import { DispatchDueAppointmentRemindersUseCase } from '../../application/use-cases/dispatch-due-appointment-reminders.use-case';
import { EnqueueDueAppointmentReminderDispatchesUseCase } from '../../application/use-cases/enqueue-due-appointment-reminder-dispatches.use-case';
import { ReconcileAppointmentReminderDispatchHealthUseCase } from '../../application/use-cases/reconcile-appointment-reminder-dispatch-health.use-case';

@Injectable()
export class AppointmentReminderScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AppointmentReminderScheduler.name);
  private dispatchTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dispatchUseCase: DispatchDueAppointmentRemindersUseCase,
    private readonly enqueueDueDispatchesUseCase: EnqueueDueAppointmentReminderDispatchesUseCase,
    private readonly reconcileUseCase: ReconcileAppointmentReminderDispatchHealthUseCase,
    private readonly configService: AppointmentReminderDispatchConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.configService.isDispatchSchedulerEnabled()) {
      this.logger.log(
        'Appointment reminder dispatcher is disabled by configuration.',
      );
      return;
    }

    const recoveryIntervalMs = this.configService.getRecoverySweepIntervalMs();

    if (!this.configService.isQueueEnabled()) {
      const dispatchIntervalMs = this.configService.getDispatchIntervalMs();
      this.dispatchTimer = setInterval(() => {
        void this.dispatchTick();
      }, dispatchIntervalMs);
      this.logger.log(
        `Appointment reminder polling dispatcher enabled with interval ${dispatchIntervalMs}ms (BullMQ disabled).`,
      );
      void this.dispatchTick();
    }

    this.recoveryTimer = setInterval(() => {
      void this.recoveryTick();
    }, recoveryIntervalMs);

    this.logger.log(
      `Appointment reminder scheduler started (recovery=${recoveryIntervalMs}ms).`,
    );
    void this.recoveryTick();
  }

  onModuleDestroy(): void {
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer);
      this.dispatchTimer = null;
    }

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private async dispatchTick(): Promise<void> {
    const workerId = `scheduler:${process.pid}`;

    try {
      const result = await this.dispatchUseCase.execute({ workerId });
      if (result.claimed === 0) {
        return;
      }

      this.logger.log(
        `Reminder dispatch batch: claimed=${result.claimed} sent=${result.sent} verificationSent=${result.verificationSent} skipped=${result.skipped} failed=${result.failed}.`,
      );
    } catch (error) {
      this.logger.error(
        'Reminder dispatch tick failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async recoveryTick(): Promise<void> {
    try {
      const result = await this.reconcileUseCase.execute();
      let recoveredDueDispatches = 0;

      if (this.configService.isQueueEnabled()) {
        const catchUpResult = await this.enqueueDueDispatchesUseCase.execute({
          runAtIso: new Date().toISOString(),
        });
        recoveredDueDispatches = catchUpResult.enqueued;
      }

      if (result.recoveredLocks === 0 && result.expiredVerifications === 0) {
        if (recoveredDueDispatches === 0) {
          return;
        }
      }

      this.logger.log(
        `Reminder recovery tick: recoveredLocks=${result.recoveredLocks} expiredVerifications=${result.expiredVerifications} recoveredDueDispatches=${recoveredDueDispatches}.`,
      );
    } catch (error) {
      this.logger.error(
        'Reminder recovery tick failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
