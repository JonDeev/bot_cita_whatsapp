import { AppointmentReminderAppointmentTimeService } from './appointment-reminder-appointment-time.service';

describe('AppointmentReminderAppointmentTimeService', () => {
  const service = new AppointmentReminderAppointmentTimeService();

  it('interprets appointment date/time in America/Bogota before converting to ISO', () => {
    const result = service.resolveAppointmentStartsAtIso({
      appointmentDateIso: '2026-06-10T00:00:00.000Z',
      appointmentTimeHhmm: '07:00',
    });

    expect(result).toBe('2026-06-10T12:00:00.000Z');
  });

  it('preserves afternoon appointments in business local time', () => {
    const result = service.resolveAppointmentStartsAtIso({
      appointmentDateIso: '2026-06-10T00:00:00.000Z',
      appointmentTimeHhmm: '15:00',
    });

    expect(result).toBe('2026-06-10T20:00:00.000Z');
  });
});
