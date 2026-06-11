import { AuditService } from '../../../audit/application/services/audit.service';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import { ConsentPhoneResolverService } from '../services/consent-phone-resolver.service';
import { AppointmentNotificationOptInMessageFactory } from '../services/appointment-notification-opt-in-message.factory';
import { RequestingWhatsappAppointmentNotificationsOptInHandler } from './requesting-whatsapp-appointment-notifications-opt-in.handler';

describe('RequestingWhatsappAppointmentNotificationsOptInHandler', () => {
  function buildHandler(
    registerConsent: RegisterWhatsappPostBookingConsentUseCase,
    consentPhoneResolver?: ConsentPhoneResolverService,
  ): RequestingWhatsappAppointmentNotificationsOptInHandler {
    return new RequestingWhatsappAppointmentNotificationsOptInHandler(
      new AppointmentNotificationOptInMessageFactory(),
      consentPhoneResolver ??
        ({
          resolve: jest.fn().mockReturnValue({
            status: 'FOUND',
            phone: '3014445566',
          }),
        } as unknown as ConsentPhoneResolverService),
      registerConsent,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('records acceptance and closes the conversation without menu list', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    } as unknown as RegisterWhatsappPostBookingConsentUseCase);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-200',
        from: '573001112233',
        timestamp: '1711119999',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_notifications_opt_in:accept',
        interactiveReplyTitle: 'Si autorizo',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: expect.stringContaining('Registramos tu autorizacion'),
    });
  });

  it('records rejection and closes the conversation without menu list', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    } as unknown as RegisterWhatsappPostBookingConsentUseCase);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-201',
        from: '573001112233',
        timestamp: '1711119999',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_notifications_opt_in:decline',
        interactiveReplyTitle: 'No autorizo',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: expect.stringContaining('no autorizas'),
    });
  });

  it('re-prompts consent message on invalid option', async () => {
    const handler = buildHandler({
      execute: jest.fn(),
    } as unknown as RegisterWhatsappPostBookingConsentUseCase);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-201',
        from: '573001112233',
        timestamp: '1711120000',
        messageType: 'text',
        textBody: 'tal vez',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe(
      'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
    );
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'appointment_notifications_opt_in:accept', title: 'Si autorizo' },
        {
          id: 'appointment_notifications_opt_in:decline',
          title: 'No autorizo',
        },
      ],
    });
  });

  it('uses a neutral response when consent persistence is skipped', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        status: 'SKIPPED',
        reason: 'INVALID_PATIENT_ID',
      }),
    } as unknown as RegisterWhatsappPostBookingConsentUseCase);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-202',
        from: '573001112233',
        timestamp: '1711120001',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_notifications_opt_in:accept',
        interactiveReplyTitle: 'Si autorizo',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: expect.stringContaining('Gracias por tu respuesta'),
    });
  });

  it('resumes the current flow when opt-in is requested from a non-finalized flow', async () => {
    const registerConsent = {
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    } as unknown as RegisterWhatsappPostBookingConsentUseCase;
    const handler = buildHandler(registerConsent);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        status: 'BOT_ACTIVE',
        context: {
          flowIntent: 'REQUEST_APPOINTMENT',
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
            verifiedPhone: '3014445566',
            invalidPhoneAttempts: 0,
            invalidEmailAttempts: 0,
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-203',
        from: '573001112233',
        timestamp: '1711120002',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_notifications_opt_in:accept',
        interactiveReplyTitle: 'Si autorizo',
        phoneNumberId: '123',
      },
    );

    expect(registerConsent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '3014445566',
      }),
    );
    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(result.nextStatus).toBeUndefined();
    expect(result.nextContext?.contactVerification?.completedForCurrentFlow).toBe(
      true,
    );
    expect(result.nextContext?.contactVerification?.pendingPhone).toBeUndefined();
    expect(result.nextContext?.contactVerification?.verifiedPhone).toBeUndefined();
  });
});
