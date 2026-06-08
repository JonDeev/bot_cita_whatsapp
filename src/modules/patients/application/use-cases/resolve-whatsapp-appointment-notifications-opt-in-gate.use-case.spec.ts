import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { ResolveWhatsappAppointmentNotificationsOptInGateUseCase } from './resolve-whatsapp-appointment-notifications-opt-in-gate.use-case';

describe('ResolveWhatsappAppointmentNotificationsOptInGateUseCase', () => {
  const patientContactInputValidator = new PatientContactInputValidatorService();

  it('returns PROMPT_NOT_REQUIRED when phone is verified and consent is still valid', async () => {
    const useCase =
      new ResolveWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'DANIEL',
            secondName: null,
            firstLastName: 'CASTANO',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'daniel@example.com',
            phoneVerifiedAtIso: '2026-05-01T10:00:00.000Z',
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
            grantedAtIso: '2026-05-02T10:00:00.000Z',
            revokedAtIso: null,
          }),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
      whatsappPhone: '3001112233',
    });

    expect(result).toEqual({
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: '2026-05-02T10:00:00.000Z',
      phoneVerifiedAtIso: '2026-05-01T10:00:00.000Z',
    });
  });

  it('returns PROMPT_REQUIRED when phone is not verified in usuarios.telefono_verificado_en', async () => {
    const useCase =
      new ResolveWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'DANIEL',
            secondName: null,
            firstLastName: 'CASTANO',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'daniel@example.com',
            phoneVerifiedAtIso: null,
            emailVerifiedAtIso: null,
          }),
        },
        {
          findConsentByPatientAndPurpose: jest.fn(),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
      whatsappPhone: '573001112233',
    });

    expect(result).toEqual({
      status: 'PROMPT_REQUIRED',
      reason: 'PHONE_NOT_VERIFIED',
    });
  });

  it('returns PROMPT_NOT_REQUIRED when consent exists even if legacy phone verification is missing', async () => {
    const useCase =
      new ResolveWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'DANIEL',
            secondName: null,
            firstLastName: 'CASTANO',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'daniel@example.com',
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
            grantedAtIso: '2026-05-02T10:00:00.000Z',
            revokedAtIso: null,
          }),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
      whatsappPhone: '3001112233',
    });

    expect(result).toEqual({
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: '2026-05-02T10:00:00.000Z',
      phoneVerifiedAtIso: '2026-05-02T10:00:00.000Z',
    });
  });

  it('returns PROMPT_REQUIRED when stored consent is older than phone verification timestamp', async () => {
    const useCase =
      new ResolveWhatsappAppointmentNotificationsOptInGateUseCase(
        {
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 98,
            firstName: 'DANIEL',
            secondName: null,
            firstLastName: 'CASTANO',
            secondLastName: null,
            primaryPhone: '3001112233',
            primaryEmail: 'daniel@example.com',
            phoneVerifiedAtIso: '2026-05-05T10:00:00.000Z',
            emailVerifiedAtIso: null,
          }),
        },
        {
          findConsentByPatientAndPurpose: jest.fn().mockResolvedValue({
            patientLegacyUserId: 98,
            phone: '3001112233',
            channel: 'WHATSAPP',
            purpose: 'APPOINTMENT_NOTIFICATIONS',
            granted: true,
            grantedAtIso: '2026-05-01T10:00:00.000Z',
            revokedAtIso: null,
          }),
        },
        patientContactInputValidator,
      );

    const result = await useCase.execute({
      patientId: 98,
      whatsappPhone: '3001112233',
    });

    expect(result).toEqual({
      status: 'PROMPT_REQUIRED',
      reason: 'CONSENT_OUTDATED_AFTER_PHONE_VERIFICATION',
    });
  });
});
