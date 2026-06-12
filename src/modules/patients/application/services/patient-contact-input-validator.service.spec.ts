import { PatientContactInputValidatorService } from './patient-contact-input-validator.service';

describe('PatientContactInputValidatorService', () => {
  const service = new PatientContactInputValidatorService();

  it('validates Colombian mobile phones after sanitizing non-digits', () => {
    expect(service.isValidColombianMobilePhone('300-123-4567')).toBe(true);
    expect(service.isValidColombianMobilePhone('0312345678')).toBe(false);
    expect(service.isValidColombianMobilePhone('320123456')).toBe(false);
  });

  it('normalizes and validates emails', () => {
    expect(service.normalizeEmail('  User@Test.com ')).toBe('user@test.com');
    expect(service.isValidEmail('paciente@gmail.com')).toBe(true);
    expect(service.isValidEmail('correo-invalido')).toBe(false);
  });

  it('compares Colombian mobile numbers consistently', () => {
    expect(service.isSamePhoneNumber('3001234567', '3001234567')).toBe(true);
    expect(service.isSamePhoneNumber('573001234567', '3001234567')).toBe(
      true,
    );
    expect(service.isSamePhoneNumber('3001234567', '573001234567')).toBe(
      true,
    );
    expect(service.isSamePhoneNumber('3001234567', '3011234567')).toBe(false);
  });
});
