import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import {
  APPOINTMENT_REMINDER_METRICS_DEFAULT_LOOKBACK_HOURS,
  APPOINTMENT_REMINDER_METRICS_LOOKBACK_ERROR_MESSAGE,
  APPOINTMENT_REMINDER_METRICS_MAX_LOOKBACK_HOURS,
  APPOINTMENT_REMINDER_METRICS_MIN_LOOKBACK_HOURS,
} from '../../domain/appointment-reminder-metrics.constants';
import { APPOINTMENT_REMINDER_METRICS_REPOSITORY } from '../../domain/reminders.tokens';
import type {
  AppointmentReminderMetricsRepository,
  AppointmentReminderOperationalMetricsSnapshot,
} from '../../domain/ports/appointment-reminder-metrics.repository';

export interface GetAppointmentReminderMetricsInput {
  lookbackHours?: number;
}

export interface GetAppointmentReminderMetricsResult extends AppointmentReminderOperationalMetricsSnapshot {
  timezone: 'America/Bogota';
}

@Injectable()
export class GetAppointmentReminderMetricsUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_METRICS_REPOSITORY)
    private readonly metricsRepository: AppointmentReminderMetricsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input?: GetAppointmentReminderMetricsInput,
  ): Promise<GetAppointmentReminderMetricsResult> {
    const lookbackHours = this.resolveLookbackHours(input?.lookbackHours);
    const runAtIso = new Date().toISOString();

    const snapshot = await this.metricsRepository.getOperationalSnapshot({
      runAtIso,
      lookbackHours,
    });

    await this.auditService.record('appointment_reminder.metrics.queried', {
      lookbackHours,
      dueDispatches: snapshot.backlog.dueDispatches,
      maxLagSeconds: snapshot.backlog.maxLagSeconds,
      sentRecent: snapshot.recent.sent,
      failedRecent: snapshot.recent.failed,
    });

    return {
      ...snapshot,
      timezone: 'America/Bogota',
    };
  }

  private resolveLookbackHours(lookbackHours: number | undefined): number {
    if (lookbackHours === undefined) {
      return APPOINTMENT_REMINDER_METRICS_DEFAULT_LOOKBACK_HOURS;
    }

    if (
      !Number.isInteger(lookbackHours) ||
      lookbackHours < APPOINTMENT_REMINDER_METRICS_MIN_LOOKBACK_HOURS ||
      lookbackHours > APPOINTMENT_REMINDER_METRICS_MAX_LOOKBACK_HOURS
    ) {
      throw new BadRequestException(
        APPOINTMENT_REMINDER_METRICS_LOOKBACK_ERROR_MESSAGE,
      );
    }

    return lookbackHours;
  }
}
