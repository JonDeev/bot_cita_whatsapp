import { Injectable } from '@nestjs/common';
import { resolveAppointmentStartsAtFromIso } from '../../domain/appointment-reminder-timezone';

@Injectable()
export class AppointmentReminderAppointmentTimeService {
  resolveAppointmentStartsAtIso(input: {
    appointmentDateIso: string;
    appointmentTimeHhmm: string;
  }): string {
    return resolveAppointmentStartsAtFromIso(input);
  }
}
