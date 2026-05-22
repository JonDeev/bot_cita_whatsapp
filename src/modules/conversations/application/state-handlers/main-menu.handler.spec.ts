import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { MainMenuHandler } from './main-menu.handler';

describe('MainMenuHandler', () => {
  it('returns the main menu as an interactive list message', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-1',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'text',
        textBody: 'hola',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      buttonText: 'Ver opciones',
    });
  });

  it('moves to WAITING_DOCUMENT when request appointment option is selected', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-1',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_request_appointment',
        interactiveReplyTitle: '⚕️ Solicitar cita',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_DOCUMENT');
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
  });

  it('moves to WAITING_DOCUMENT when cancel or reschedule option is selected', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_cancel_or_reschedule',
        interactiveReplyTitle: '⚠️ Cancelar/Reprogramar',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_DOCUMENT');
    expect(result.nextContext).toMatchObject({
      flowIntent: 'CANCEL_OR_RESCHEDULE',
    });
  });

  it('moves to WAITING_DOCUMENT when check appointments option is selected', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-3',
        from: '573001112233',
        timestamp: '1711111113',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_check_appointments',
        interactiveReplyTitle: '🔍 Consultar citas',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_DOCUMENT');
    expect(result.nextContext).toMatchObject({
      flowIntent: 'CHECK_APPOINTMENTS',
    });
  });

  it('moves to WAITING_DOCUMENT when dispensary option is selected', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-4',
        from: '573001112233',
        timestamp: '1711111114',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_check_dispensary',
        interactiveReplyTitle: '💊 MI DISPENSARIO',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_DOCUMENT');
    expect(result.nextContext).toMatchObject({
      flowIntent: 'CHECK_DISPENSARY',
    });
  });

  it('moves to WAITING_DOCUMENT when update contact option is selected', async () => {
    const handler = new MainMenuHandler(new MainMenuListFactory());

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-5',
        from: '573001112233',
        timestamp: '1711111115',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_update_contact',
        interactiveReplyTitle: '📝 Actualizar contacto',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_DOCUMENT');
    expect(result.nextContext).toMatchObject({
      flowIntent: 'UPDATE_CONTACT',
    });
  });
});
