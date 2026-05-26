import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderWindowService {
  resolveScheduledForIso(appointmentStartsAtIso: string): string {
    const startsAt = new Date(appointmentStartsAtIso);
    return new Date(startsAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  resolveVerificationExpiresAtIso(appointmentStartsAtIso: string): string {
    const startsAt = new Date(appointmentStartsAtIso);
    return new Date(startsAt.getTime() - 3 * 60 * 60 * 1000).toISOString();
  }

  hasAtLeastHoursBeforeAppointment(input: {
    appointmentStartsAtIso: string;
    referenceIso: string;
    minimumHours: number;
  }): boolean {
    const appointmentStartsAt = new Date(input.appointmentStartsAtIso).getTime();
    const referenceTime = new Date(input.referenceIso).getTime();
    const thresholdMs = input.minimumHours * 60 * 60 * 1000;

    return appointmentStartsAt - referenceTime >= thresholdMs;
  }
}
