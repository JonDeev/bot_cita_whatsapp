import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase } from './resolve-post-booking-whatsapp-appointment-notifications-opt-in-gate.use-case';

describe('ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase', () => {
  const patientContactInputValidator = new PatientContactInputValidatorService();

  it('returns PROMPT_NOT_REQUIRED when stored consent matches the official phone', async () => {
    const useCase =
      new ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'SANDRA',
            secondName: null,
            firstLastName: 'MARTINEZ',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'sandra@example.com',
            phoneVerifiedAtIso: null,
            emailVerifiedAtIso: null,
          }),
        },
        {
          findConsentByPatientAndPurpose: jest.fn().mockResolvedValue({
            patientLegacyUserId: 98,
            phone: '573001112233',
            channel: 'WHATSAPP',
            purpose: 'APPOINTMENT_NOTIFICATIONS',
            granted: true,
            grantedAtIso: '2026-06-01T10:00:00.000Z',
            revokedAtIso: null,
          }),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
    });

    expect(result).toEqual({
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: '2026-06-01T10:00:00.000Z',
      officialPhone: '3001112233',
    });
  });

  it('returns PROMPT_REQUIRED when consent is stored for a different phone', async () => {
    const useCase =
      new ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'SANDRA',
            secondName: null,
            firstLastName: 'MARTINEZ',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'sandra@example.com',
            phoneVerifiedAtIso: null,
            emailVerifiedAtIso: null,
          }),
        },
        {
          findConsentByPatientAndPurpose: jest.fn().mockResolvedValue({
            patientLegacyUserId: 98,
            phone: '3009998888',
            channel: 'WHATSAPP',
            purpose: 'APPOINTMENT_NOTIFICATIONS',
            granted: true,
            grantedAtIso: '2026-06-01T10:00:00.000Z',
            revokedAtIso: null,
          }),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
    });

    expect(result).toEqual({
      status: 'PROMPT_REQUIRED',
      reason: 'CONSENT_PHONE_MISMATCH',
      officialPhone: '3001112233',
    });
  });

  it('returns PROMPT_REQUIRED when no consent exists yet', async () => {
    const useCase =
      new ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'SANDRA',
            secondName: null,
            firstLastName: 'MARTINEZ',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'sandra@example.com',
            phoneVerifiedAtIso: null,
            emailVerifiedAtIso: null,
          }),
        },
        {
          findConsentByPatientAndPurpose: jest.fn().mockResolvedValue(null),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
    });

    expect(result).toEqual({
      status: 'PROMPT_REQUIRED',
      reason: 'CONSENT_NOT_GRANTED',
      officialPhone: '3001112233',
    });
  });
});
