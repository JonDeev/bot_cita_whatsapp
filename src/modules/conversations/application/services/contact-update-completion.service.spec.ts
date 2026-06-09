import { AppointmentNotificationOptInMessageFactory } from './appointment-notification-opt-in-message.factory';
import { ContactUpdateCompletionService } from './contact-update-completion.service';
import { ResolveWhatsappAppointmentNotificationsOptInGateUseCase } from '../../../patients/application/use-cases/resolve-whatsapp-appointment-notifications-opt-in-gate.use-case';

describe('ContactUpdateCompletionService', () => {
  function buildService(
    gateResult: Awaited<
      ReturnType<ResolveWhatsappAppointmentNotificationsOptInGateUseCase['execute']>
    >,
  ): ContactUpdateCompletionService {
    return new ContactUpdateCompletionService(
      {
        execute: jest.fn().mockResolvedValue(gateResult),
      } as unknown as ResolveWhatsappAppointmentNotificationsOptInGateUseCase,
      new AppointmentNotificationOptInMessageFactory(),
    );
  }

  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'UPDATING_CONTACT_PHONE',
    status: 'BOT_ACTIVE',
    context: {
      flowIntent: 'REQUEST_APPOINTMENT',
      patientValidation: {
        failedAttempts: 0,
        patientId: 10,
      },
      contactVerification: {
        fullName: 'DANIEL CASTANO',
        primaryPhone: '3001234567',
        primaryEmail: 'daniel@example.com',
        requiresPhoneUpdate: false,
        requiresEmailUpdate: false,
        selectedUpdateMode: 'PHONE',
        completedForCurrentFlow: false,
        invalidPhoneAttempts: 0,
        invalidEmailAttempts: 0,
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  } as const;

  it('prompts for opt-in after a successful phone update when gate requires it', async () => {
    const service = buildService({
      status: 'PROMPT_REQUIRED',
      reason: 'CONSENT_NOT_GRANTED',
    });

    const result = await service.buildResult({
      session: baseSession,
      verifiedPhone: '3014445566',
      successMessage: {
        type: 'text',
        body: 'Tus datos de contacto quedaron confirmados y actualizados correctamente.',
      },
    });

    expect(result.nextState).toBe(
      'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
    );
    expect(result.outboundMessages).toHaveLength(2);
    expect(result.nextContext?.contactVerification?.verifiedPhone).toBe(
      '3014445566',
    );
  });

  it('closes the conversation for UPDATE_CONTACT when opt-in is not required', async () => {
    const service = buildService({
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: '2026-05-04T10:00:00.000Z',
      phoneVerifiedAtIso: '2026-05-04T10:00:00.000Z',
    });

    const result = await service.buildResult({
      session: {
        ...baseSession,
        context: {
          ...baseSession.context,
          flowIntent: 'UPDATE_CONTACT',
        },
      },
      verifiedPhone: '3014445566',
      successMessage: {
        type: 'text',
        body: 'Tus datos de contacto quedaron confirmados y actualizados correctamente.',
      },
    });

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
  });

  it('returns to PATIENT_VALIDATED when opt-in is not required in a live flow', async () => {
    const service = buildService({
      status: 'PROMPT_NOT_REQUIRED',
      consentGrantedAtIso: '2026-05-04T10:00:00.000Z',
      phoneVerifiedAtIso: '2026-05-04T10:00:00.000Z',
    });

    const result = await service.buildResult({
      session: baseSession,
      verifiedPhone: '3014445566',
      successMessage: {
        type: 'text',
        body: 'Tus datos de contacto quedaron confirmados y actualizados correctamente.',
      },
    });

    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(result.nextStatus).toBeUndefined();
    expect(result.nextContext?.contactVerification?.completedForCurrentFlow).toBe(
      true,
    );
  });
});
