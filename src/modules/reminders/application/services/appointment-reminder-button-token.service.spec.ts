import { AppointmentReminderButtonTokenService } from './appointment-reminder-button-token.service';

describe('AppointmentReminderButtonTokenService', () => {
  const originalSecret = process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET;

  beforeEach(() => {
    process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET = originalSecret;
  });

  it('creates and verifies a valid token', () => {
    const service = new AppointmentReminderButtonTokenService();
    const token = service.createToken({
      dispatchId: 42,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });

    const verified = service.verifyToken(token);
    expect(verified).toEqual({
      dispatchId: 42,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
  });

  it('rejects tampered token signatures', () => {
    const service = new AppointmentReminderButtonTokenService();
    const token = service.createToken({
      dispatchId: 42,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });

    const tampered = `${token}x`;
    expect(service.verifyToken(tampered)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const service = new AppointmentReminderButtonTokenService();
    const token = service.createToken({
      dispatchId: 42,
      expiresAtIso: '2000-01-01T00:00:00.000Z',
    });

    expect(service.verifyToken(token)).toBeNull();
  });
});
