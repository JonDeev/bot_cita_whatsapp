import { RegisterWhatsappPostBookingConsentUseCase } from './register-whatsapp-post-booking-consent.use-case';

describe('RegisterWhatsappPostBookingConsentUseCase', () => {
  it('records consent for both appointment notifications and satisfaction surveys', async () => {
    const repository = {
      recordConsent: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new RegisterWhatsappPostBookingConsentUseCase(repository);
    const result = await useCase.execute({
      patientId: 98,
      phone: '573001112233',
      granted: true,
      consentTextSnapshot: 'Autorizo contacto por WhatsApp.',
    });

    expect(result).toEqual({ status: 'RECORDED' });
    expect(repository.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        patientLegacyUserId: 98,
        phone: '573001112233',
        channel: 'WHATSAPP',
        response: 'ACCEPTED',
        purposes: ['APPOINTMENT_NOTIFICATIONS', 'SATISFACTION_SURVEYS'],
      }),
    );
  });

  it('skips when patient id is invalid', async () => {
    const repository = {
      recordConsent: jest.fn(),
    };

    const useCase = new RegisterWhatsappPostBookingConsentUseCase(repository);
    const result = await useCase.execute({
      patientId: null,
      phone: '573001112233',
      granted: true,
      consentTextSnapshot: 'Autorizo contacto por WhatsApp.',
    });

    expect(result).toEqual({
      status: 'SKIPPED',
      reason: 'INVALID_PATIENT_ID',
    });
    expect(repository.recordConsent).not.toHaveBeenCalled();
  });
});
