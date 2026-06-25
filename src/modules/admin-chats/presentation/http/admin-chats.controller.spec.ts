import { AdminChatsController } from './admin-chats.controller';

describe('AdminChatsController', () => {
  function buildController() {
    const parser = {
      parseListChatsQuery: jest.fn(),
      parseListMessagesQuery: jest.fn(),
    };
    const listChats = {
      execute: jest.fn(),
    };
    const getChatDetail = {
      execute: jest.fn(),
    };
    const listChatMessages = {
      execute: jest.fn(),
    };

    const controller = new AdminChatsController(
      parser as never,
      listChats as never,
      getChatDetail as never,
      listChatMessages as never,
    );

    return {
      controller,
      parser,
      listChats,
      getChatDetail,
      listChatMessages,
    };
  }

  it('delegates list and detail responses without altering the chat contract', async () => {
    const fixture = buildController();
    const adminAuth = {
      user: {
        id: 15,
        role: 'SUPERVISOR',
      },
    };
    const listResponse = {
      items: [
        {
          id: 10,
          participantPhone: '573001112233',
          state: 'MAIN_MENU',
          status: 'BOT_ACTIVE',
          updatedAtIso: '2026-06-25T10:00:00.000Z',
          lastMessageDirection: 'INBOUND' as const,
          lastMessageType: 'text',
          lastMessagePreview: 'hola',
          lastMessageOccurredAtIso: '2026-06-25T09:59:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const detailResponse = {
      id: 10,
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      state: 'MAIN_MENU',
      status: 'BOT_ACTIVE',
      lastInboundAtIso: null,
      idleExpiresAtIso: null,
      createdAtIso: '2026-06-25T10:00:00.000Z',
      updatedAtIso: '2026-06-25T10:00:00.000Z',
    };

    fixture.parser.parseListChatsQuery.mockReturnValue({
      page: 1,
      pageSize: 20,
      status: null,
      participantPhoneContains: null,
      fromIso: null,
      toIso: null,
    });
    fixture.parser.parseListMessagesQuery.mockReturnValue({
      conversationId: 10,
      page: 1,
      pageSize: 20,
    });
    fixture.listChats.execute.mockResolvedValue(listResponse);
    fixture.getChatDetail.execute.mockResolvedValue(detailResponse);
    fixture.listChatMessages.execute.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await expect(
      fixture.controller.list(adminAuth as never, {
        page: '1',
        pageSize: '20',
      }),
    ).resolves.toEqual(listResponse);
    await expect(
      fixture.controller.detail(adminAuth as never, 10),
    ).resolves.toEqual(detailResponse);

    expect(fixture.parser.parseListChatsQuery).toHaveBeenCalledWith({
      page: '1',
      pageSize: '20',
    });
    expect(fixture.listChats.execute).toHaveBeenCalledWith(15, 'SUPERVISOR', {
      page: 1,
      pageSize: 20,
      status: null,
      participantPhoneContains: null,
      fromIso: null,
      toIso: null,
    });
    expect(fixture.getChatDetail.execute).toHaveBeenCalledWith(
      15,
      'SUPERVISOR',
      10,
    );
  });

  it('delegates messages queries through parser and use case', async () => {
    const fixture = buildController();
    const adminAuth = {
      user: {
        id: 18,
        role: 'ADMIN',
      },
    };
    const messagesResponse = {
      items: [
        {
          id: 91,
          direction: 'INBOUND' as const,
          whatsappMessageId: 'wamid.1',
          messageType: 'text',
          body: 'hola mundo',
          payload: null,
          occurredAtIso: '2026-06-25T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    fixture.parser.parseListMessagesQuery.mockReturnValue({
      conversationId: 10,
      page: 2,
      pageSize: 50,
    });
    fixture.listChatMessages.execute.mockResolvedValue(messagesResponse);

    await expect(
      fixture.controller.listMessages(adminAuth as never, 10, {
        page: '2',
        pageSize: '50',
      }),
    ).resolves.toEqual(messagesResponse);

    expect(fixture.parser.parseListMessagesQuery).toHaveBeenCalledWith(10, {
      page: '2',
      pageSize: '50',
    });
    expect(fixture.listChatMessages.execute).toHaveBeenCalledWith(
      18,
      'ADMIN',
      {
        conversationId: 10,
        page: 2,
        pageSize: 50,
      },
    );
  });
});
