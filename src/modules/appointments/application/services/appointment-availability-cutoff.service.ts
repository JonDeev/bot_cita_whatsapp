import { Injectable } from '@nestjs/common';

export interface AppointmentAvailabilityCutoff {
  cutoffDateIso: string;
  cutoffTimeHHmm: string;
}

@Injectable()
export class AppointmentAvailabilityCutoffService {
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly CUT_OFF_OFFSET_HOURS = 2;

  build(now: Date): AppointmentAvailabilityCutoff {
    const cutoff = new Date(
      now.getTime() +
        AppointmentAvailabilityCutoffService.CUT_OFF_OFFSET_HOURS * 60 * 60 * 1000,
    );
    const parts = this.formatToParts(cutoff);

    return {
      cutoffDateIso: `${parts.year}-${parts.month}-${parts.day}`,
      cutoffTimeHHmm: `${parts.hour}:${parts.minute}`,
    };
  }

  private formatToParts(value: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: AppointmentAvailabilityCutoffService.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const partEntries = formatter
      .formatToParts(value)
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute'].includes(part.type),
      )
      .map((part) => [part.type, part.value] as const);

    return Object.fromEntries(partEntries) as Record<
      'year' | 'month' | 'day' | 'hour' | 'minute',
      string
    >;
  }
}
