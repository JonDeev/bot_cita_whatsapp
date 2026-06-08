import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type {
  AppointmentReminderDispatchQueuePort,
  ScheduleAppointmentReminderDispatchJobCommand,
} from '../../domain/ports/appointment-reminder-dispatch-queue.port';
import { AppointmentReminderDispatchConfigService } from '../../application/services/appointment-reminder-dispatch-config.service';

interface ReminderDispatchJobData {
  dispatchId: number;
}

const REMINDER_DISPATCH_JOB_ID_PREFIX = 'reminder-dispatch';

@Injectable()
export class BullmqAppointmentReminderDispatchQueue
  implements AppointmentReminderDispatchQueuePort, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqAppointmentReminderDispatchQueue.name);
  private readonly queue: Queue<ReminderDispatchJobData>;

  constructor(
    private readonly configService: AppointmentReminderDispatchConfigService,
  ) {
    this.queue = new Queue<ReminderDispatchJobData>(
      this.configService.getQueueName(),
      {
        connection: {
          url: this.getRedisUrl(),
        },
      },
    );
  }

  async scheduleDispatchJob(
    command: ScheduleAppointmentReminderDispatchJobCommand,
  ): Promise<void> {
    const jobId = this.toJobId(command.dispatchId);
    const delay = Math.max(
      0,
      Date.parse(command.scheduledForIso) - Date.now(),
    );

    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting' || state === 'prioritized') {
        await existing.remove();
      }
    }

    await this.queue.add(
      'dispatch',
      { dispatchId: command.dispatchId },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    this.logger.debug(
      `Scheduled reminder dispatch job ${jobId} with delay=${delay}ms.`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private toJobId(dispatchId: number): string {
    return `${REMINDER_DISPATCH_JOB_ID_PREFIX}-${dispatchId}`;
  }

  private getRedisUrl(): string {
    const redisUrl = (process.env.REDIS_URL ?? '').trim();
    if (!redisUrl) {
      throw new Error('Missing REDIS_URL environment variable.');
    }

    return redisUrl;
  }
}
