import { AdminLogsMaskingService } from './admin-logs-masking.service';

describe('AdminLogsMaskingService', () => {
  const service = new AdminLogsMaskingService();

  it('hides metadata and failure details for SUPERVISOR', () => {
    const mappedEvents = service.mapEvents('SUPERVISOR', {
      items: [
        {
          id: 1,
          action: 'bot.failure',
          conversationId: 10,
          conversationKey: 'c-1',
          occurredAtIso: new Date().toISOString(),
          metadata: { debug: true },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const mappedFailures = service.mapFailures('SUPERVISOR', {
      items: [
        {
          source: 'OUTBOX',
          id: 1,
          status: 'FAILED',
          errorCode: 'WHATSAPP_500',
          errorMessage: 'timeout',
          occurredAtIso: new Date().toISOString(),
          conversationId: 10,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(mappedEvents.items[0].metadata).toBeNull();
    expect(mappedEvents.items[0].conversationKey).toBeNull();
    expect(mappedFailures.items[0].errorCode).toBeNull();
    expect(mappedFailures.items[0].errorMessage).toBeNull();
  });

  it('keeps technical event fields for ADMIN', () => {
    const mappedEvents = service.mapEvents('ADMIN', {
      items: [
        {
          id: 1,
          action: 'bot.failure',
          conversationId: 10,
          conversationKey: 'whatsapp:123:573001112233',
          occurredAtIso: new Date().toISOString(),
          metadata: { debug: true },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(mappedEvents.items[0].conversationKey).toBe(
      'whatsapp:123:573001112233',
    );
    expect(mappedEvents.items[0].metadata).toEqual({ debug: true });
  });
});
