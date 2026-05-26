import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderAppointmentTimeService {
  resolveAppointmentStartsAtIso(input: {
    appointmentDateIso: string;
    appointmentTimeHhmm: string;
  }): string {
    const date = new Date(input.appointmentDateIso);
    const match = /^(?<hour>\d{2}):(?<minute>\d{2})$/.exec(
      input.appointmentTimeHhmm,
    );

    if (!match?.groups) {
      throw new Error(
        `Invalid appointment time format: ${input.appointmentTimeHhmm}`,
      );
    }

    const hour = Number.parseInt(match.groups.hour, 10);
    const minute = Number.parseInt(match.groups.minute, 10);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error(
        `Invalid appointment time value: ${input.appointmentTimeHhmm}`,
      );
    }

    const appointmentStartsAt = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hour,
        minute,
        0,
        0,
      ),
    );

    return appointmentStartsAt.toISOString();
  }
}
