import { Injectable } from '@nestjs/common';
import { GetAppointmentReminderMetricsUseCase } from '../../../reminders/application/use-cases/get-appointment-reminder-metrics.use-case';

@Injectable()
export class GetAdminReminderMetricsUseCase {
  constructor(
    private readonly getMetrics: GetAppointmentReminderMetricsUseCase,
  ) {}

  execute(lookbackHours: number | undefined) {
    return this.getMetrics.execute({ lookbackHours });
  }
}
