import { AdminChatsMapperService } from './admin-chats-mapper.service';

describe('AdminChatsMapperService', () => {
  const service = new AdminChatsMapperService();

  it('maps lastMessageBody into lastMessagePreview for list responses', () => {
    const result = service.mapChatList({
      items: [
        {
          id: 10,
          conversationKey: 'whatsapp:123:573001112233',
          participantPhone: '573001112233',
          state: 'MAIN_MENU',
          status: 'BOT_ACTIVE',
          lastInboundAtIso: null,
          updatedAtIso: '2026-05-28T10:00:00.000Z',
          lastMessageDirection: 'INBOUND',
          lastMessageType: 'text',
          lastMessageBody: 'hola',
          lastMessageOccurredAtIso: '2026-05-28T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]?.lastMessagePreview).toBe('hola');
    expect(result.items[0]?.participantPhone).toBe('573001112233');
  });
});
