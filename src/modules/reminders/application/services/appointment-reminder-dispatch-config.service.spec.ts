import { AppointmentReminderDispatchConfigService } from './appointment-reminder-dispatch-config.service';

describe('AppointmentReminderDispatchConfigService', () => {
  const originalLockTtl = process.env.APPOINTMENT_REMINDERS_LOCK_TTL_SECONDS;
  const originalHeartbeat =
    process.env.APPOINTMENT_REMINDERS_LOCK_HEARTBEAT_INTERVAL_MS;

  afterEach(() => {
    process.env.APPOINTMENT_REMINDERS_LOCK_TTL_SECONDS = originalLockTtl;
    process.env.APPOINTMENT_REMINDERS_LOCK_HEARTBEAT_INTERVAL_MS =
      originalHeartbeat;
  });

  it('caps heartbeat interval to lock ttl window', () => {
    process.env.APPOINTMENT_REMINDERS_LOCK_TTL_SECONDS = '120';
    process.env.APPOINTMENT_REMINDERS_LOCK_HEARTBEAT_INTERVAL_MS = '300000';

    const service = new AppointmentReminderDispatchConfigService();

    expect(service.getLockHeartbeatIntervalMs()).toBe(120_000);
  });

  it('uses configured heartbeat when it is lower than lock ttl window', () => {
    process.env.APPOINTMENT_REMINDERS_LOCK_TTL_SECONDS = '300';
    process.env.APPOINTMENT_REMINDERS_LOCK_HEARTBEAT_INTERVAL_MS = '45000';

    const service = new AppointmentReminderDispatchConfigService();

    expect(service.getLockHeartbeatIntervalMs()).toBe(45_000);
  });
});
