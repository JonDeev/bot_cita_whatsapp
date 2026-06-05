import { PatientIdentityInputNormalizerService } from './patient-identity-input-normalizer.service';

describe('PatientIdentityInputNormalizerService', () => {
  const service = new PatientIdentityInputNormalizerService();

  it('sanitizes document numbers and removes non-digits', () => {
    expect(service.sanitizeDocumentNumber('CC 1.234.567')).toBe('1234567');
  });

  it('parses DD-MM-YYYY dates into ISO format', () => {
    expect(service.parseWhatsappBirthDate('05-11-1990')).toEqual({
      isoDate: '1990-11-05',
    });
  });

  it('parses DD/MM/YYYY dates into ISO format', () => {
    expect(service.parseWhatsappBirthDate('05/11/1990')).toEqual({
      isoDate: '1990-11-05',
    });
  });

  it('normalizes patient sex codes F, M and I', () => {
    expect(service.normalizePatientSexCode('f')).toBe('F');
    expect(service.normalizePatientSexCode('M')).toBe('M');
    expect(service.normalizePatientSexCode(' i ')).toBe('I');
    expect(service.normalizePatientSexCode('H')).toBeNull();
  });
});
