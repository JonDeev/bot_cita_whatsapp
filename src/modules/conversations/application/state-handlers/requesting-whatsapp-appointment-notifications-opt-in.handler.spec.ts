import { AuditService } from '../../../audit/application/services/audit.service';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import { AppointmentNotificationOptInMessageFactory } from '../services/appointment-notification-opt-in-message.factory';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { RequestingWhatsappAppointmentNotificationsOptInHandler } from './requesting-whatsapp-appointment-notifications-opt-in.handler';

describe('RequestingWhatsappAppointmentNotificationsOptInHandler', () => {
  function buildHandler(
    registerConsent: RegisterWhatsappPostBookingConsentUseCase,
  ): RequestingWhatsappAppointmentNotificationsOptInHandler {
    return new RequestingWhatsappAppointmentNotificationsOptInHandler(
      new AppointmentNotificationOptInMessageFactory(),
      registerConsent,
      new MainMenuListFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('records acceptance and returns to main menu with menu list', async () => {
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
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: expect.stringContaining('Registramos tu autorizacion'),
    });
    expect(result.outboundMessages[1]).toMatchObject({
      type: 'interactive_list',
      buttonText: 'Ver opciones',
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
});
