import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { PatientContactRevalidationPolicyService } from './patient-contact-revalidation-policy.service';

describe('PatientContactRevalidationPolicyService', () => {
  const service = new PatientContactRevalidationPolicyService(
    new PatientContactInputValidatorService(),
  );

  it('does not require revalidation when the number is verified and matches the session', () => {
    const result = service.evaluate({
      primaryPhone: '3001234567',
      phoneVerifiedAtIso: '2026-06-10T10:00:00.000Z',
      participantPhone: '573001234567',
    });

    expect(result).toEqual({
      requiresPhoneRevalidation: false,
      reasons: [],
    });
  });

  it('requires revalidation when the phone is not verified and the session phone does not match', () => {
    const result = service.evaluate({
      primaryPhone: '3001234567',
      phoneVerifiedAtIso: null,
      participantPhone: '573001112233',
    });

    expect(result).toEqual({
      requiresPhoneRevalidation: true,
      reasons: ['PHONE_NOT_VERIFIED', 'SESSION_PHONE_MISMATCH'],
    });
  });

  it('requires revalidation when the phone is missing or invalid', () => {
    expect(
      service.evaluate({
        primaryPhone: null,
        phoneVerifiedAtIso: null,
        participantPhone: '573001112233',
      }),
    ).toEqual({
      requiresPhoneRevalidation: true,
      reasons: ['MISSING_PHONE'],
    });

    expect(
      service.evaluate({
        primaryPhone: '12345',
        phoneVerifiedAtIso: null,
        participantPhone: '573001112233',
      }),
    ).toEqual({
      requiresPhoneRevalidation: true,
      reasons: ['INVALID_PHONE'],
    });
  });
});
