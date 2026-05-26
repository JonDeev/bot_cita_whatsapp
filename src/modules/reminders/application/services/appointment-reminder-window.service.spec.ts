import { AppointmentReminderWindowService } from './appointment-reminder-window.service';

describe('AppointmentReminderWindowService', () => {
  const service = new AppointmentReminderWindowService();

  it('calculates scheduled-for at 24h before appointment', () => {
    const scheduledFor = service.resolveScheduledForIso('2026-05-27T15:00:00.000Z');
    expect(scheduledFor).toBe('2026-05-26T15:00:00.000Z');
  });

  it('calculates verification expiration at 3h before appointment', () => {
    const expiresAt = service.resolveVerificationExpiresAtIso('2026-05-27T15:00:00.000Z');
    expect(expiresAt).toBe('2026-05-27T12:00:00.000Z');
  });

  it('validates minimum hours before appointment', () => {
    const accepted = service.hasAtLeastHoursBeforeAppointment({
      appointmentStartsAtIso: '2026-05-27T15:00:00.000Z',
      referenceIso: '2026-05-27T11:59:59.000Z',
      minimumHours: 3,
    });
    const rejected = service.hasAtLeastHoursBeforeAppointment({
      appointmentStartsAtIso: '2026-05-27T15:00:00.000Z',
      referenceIso: '2026-05-27T12:00:01.000Z',
      minimumHours: 3,
    });

    expect(accepted).toBe(true);
    expect(rejected).toBe(false);
  });
});
