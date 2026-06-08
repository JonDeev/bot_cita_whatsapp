import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_REMINDER_DISPATCH_QUEUE } from '../../domain/reminder-queue.tokens';
import { APPOINTMENT_REMINDER_DISPATCH_REPOSITORY } from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchQueuePort } from '../../domain/ports/appointment-reminder-dispatch-queue.port';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';

@Injectable()
export class EnqueueDueAppointmentReminderDispatchesUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_DISPATCH_REPOSITORY)
    private readonly dispatchRepository: AppointmentReminderDispatchRepository,
    @Inject(APPOINTMENT_REMINDER_DISPATCH_QUEUE)
    private readonly dispatchQueue: AppointmentReminderDispatchQueuePort,
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(input?: { runAtIso?: string }): Promise<{ enqueued: number }> {
    if (!this.configService.isQueueEnabled()) {
      return { enqueued: 0 };
    }

    const runAtIso = input?.runAtIso ?? new Date().toISOString();
    const runtimeSettings = this.runtimeResolver
      ? await this.runtimeResolver.resolveEffectiveHotReloadableSettings()
      : {
          dispatchBatchSize: this.configService.getDispatchBatchSize(),
        };
    const dueDispatchIds = await this.dispatchRepository.findDueDispatchIds({
      runAtIso,
      limit: runtimeSettings.dispatchBatchSize,
    });

    for (const dispatchId of dueDispatchIds) {
      await this.dispatchQueue.scheduleDispatchJob({
        dispatchId,
        scheduledForIso: runAtIso,
      });
    }

    return { enqueued: dueDispatchIds.length };
  }
}
