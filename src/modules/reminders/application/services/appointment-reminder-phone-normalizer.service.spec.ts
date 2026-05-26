import { AppointmentReminderPhoneNormalizerService } from './appointment-reminder-phone-normalizer.service';

describe('AppointmentReminderPhoneNormalizerService', () => {
  const service = new AppointmentReminderPhoneNormalizerService();

  it('normalizes valid colombian mobile numbers', () => {
    expect(service.normalizeLegacyPhone('300 123 4567')).toBe('3001234567');
  });

  it('rejects non-mobile or malformed numbers', () => {
    expect(service.normalizeLegacyPhone('6011234567')).toBeNull();
    expect(service.normalizeLegacyPhone('')).toBeNull();
  });

  it('formats to e164 and masks values', () => {
    expect(service.toE164Colombia('3001234567')).toBe('573001234567');
    expect(service.maskPhone('573001234567')).toBe('******4567');
  });
});
