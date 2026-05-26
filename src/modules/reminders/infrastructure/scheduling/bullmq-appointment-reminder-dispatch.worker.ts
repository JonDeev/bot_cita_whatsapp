import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppointmentReminderDispatchConfigService } from '../../application/services/appointment-reminder-dispatch-config.service';
import { DispatchDueAppointmentRemindersUseCase } from '../../application/use-cases/dispatch-due-appointment-reminders.use-case';

interface ReminderDispatchJobData {
  dispatchId: number;
}

@Injectable()
export class BullmqAppointmentReminderDispatchWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    BullmqAppointmentReminderDispatchWorker.name,
  );
  private worker: Worker<ReminderDispatchJobData> | null = null;

  constructor(
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly dispatchUseCase: DispatchDueAppointmentRemindersUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.configService.isDispatchSchedulerEnabled()) {
      this.logger.log(
        'Appointment reminder dispatcher is disabled by configuration.',
      );
      return;
    }

    if (!this.configService.isQueueEnabled()) {
      this.logger.log('BullMQ reminder queue is disabled by configuration.');
      return;
    }

    this.worker = new Worker<ReminderDispatchJobData>(
      this.configService.getQueueName(),
      async (job: Job<ReminderDispatchJobData>) => {
        const workerId = `bullmq:${process.pid}:${String(job.id)}`;
        await this.dispatchUseCase.execute({
          workerId,
          restrictToDispatchIds: [job.data.dispatchId],
        });
      },
      {
        connection: {
          url: this.getRedisUrl(),
        },
        concurrency: this.configService.getWorkerConcurrency(),
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Reminder dispatch job completed: ${String(job.id)}.`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Reminder dispatch job failed: ${String(job?.id ?? 'unknown')}.`,
        error?.stack,
      );
    });

    this.logger.log(
      `BullMQ reminder worker started on queue ${this.configService.getQueueName()} with concurrency ${this.configService.getWorkerConcurrency()}.`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;
  }

  private getRedisUrl(): string {
    const redisUrl = (process.env.REDIS_URL ?? '').trim();
    if (!redisUrl) {
      throw new Error('Missing REDIS_URL environment variable.');
    }

    return redisUrl;
  }
}
