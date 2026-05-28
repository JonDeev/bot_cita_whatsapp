import { AdminConversationsMaskingService } from './admin-conversations-masking.service';

describe('AdminConversationsMaskingService', () => {
  const service = new AdminConversationsMaskingService();

  it('masks technical payload for SUPERVISOR', () => {
    const result = service.mapConversationMessages('SUPERVISOR', {
      items: [
        {
          id: 1,
          direction: 'INBOUND',
          whatsappMessageId: 'wamid.1',
          messageType: 'text',
          body: 'hola mundo',
          payload: { raw: true },
          occurredAtIso: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].payload).toBeNull();
    expect(result.items[0].body).toContain('******');
  });

  it('keeps payload for ADMIN', () => {
    const result = service.mapConversationMessages('ADMIN', {
      items: [
        {
          id: 1,
          direction: 'INBOUND',
          whatsappMessageId: 'wamid.1',
          messageType: 'text',
          body: 'hola mundo',
          payload: { raw: true },
          occurredAtIso: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].payload).toEqual({ raw: true });
  });

  it('hides conversation key for SUPERVISOR in detail view', () => {
    const result = service.mapConversationDetail('SUPERVISOR', {
      id: 1,
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      state: 'MAIN_MENU',
      status: 'BOT_ACTIVE',
      lastInboundAtIso: null,
      idleExpiresAtIso: null,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    });

    expect(result.conversationKey).toBe('RESTRICTED');
  });
});
