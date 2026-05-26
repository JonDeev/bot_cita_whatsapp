import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderMetricsAccessConfigService {
  getInternalToken(): string | null {
    const token = (process.env.INTERNAL_REMINDERS_METRICS_TOKEN ?? '').trim();
    return token.length > 0 ? token : null;
  }
}
