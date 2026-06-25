import { ListAdminChatMessagesUseCase } from './list-admin-chat-messages.use-case';
import type { AdminChatsRepository } from '../../domain/ports/admin-chats.repository';

describe('ListAdminChatMessagesUseCase', () => {
  it('masks message content for non-admin roles before mapping the response', async () => {
    const repositoryResult = {
      items: [
        {
          id: 91,
          direction: 'INBOUND' as const,
          whatsappMessageId: 'wamid.1',
          messageType: 'text',
          body: 'hola mundo',
          payload: { raw: true },
          occurredAtIso: '2026-06-25T10:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    const maskedResult = {
      items: [
        {
          id: 91,
          direction: 'INBOUND' as const,
          whatsappMessageId: 'wamid.1',
          messageType: 'text',
          body: 'ho******',
          payload: null,
          occurredAtIso: '2026-06-25T10:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    const repository: jest.Mocked<AdminChatsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn(),
      listConversationMessages: jest.fn().mockResolvedValue(repositoryResult),
    };
    const masking = {
      mapConversationList: jest.fn(),
      mapConversationDetail: jest.fn(),
      mapConversationMessages: jest.fn().mockReturnValue(maskedResult),
    };
    const mapper = {
      mapChatList: jest.fn(),
      mapChatDetail: jest.fn(),
      mapChatMessages: jest.fn().mockReturnValue(maskedResult),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ListAdminChatMessagesUseCase(
      repository,
      masking as never,
      mapper as never,
      audit as never,
    );

    const result = await useCase.execute(22, 'SUPERVISOR', {
      conversationId: 77,
      page: 1,
      pageSize: 20,
    });

    expect(repository.listConversationMessages).toHaveBeenCalledWith({
      conversationId: 77,
      page: 1,
      pageSize: 20,
    });
    expect(masking.mapConversationMessages).toHaveBeenCalledWith(
      'SUPERVISOR',
      repositoryResult,
    );
    expect(mapper.mapChatMessages).toHaveBeenCalledWith(maskedResult);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 22,
        action: 'admin.chat.messages_viewed',
        resourceType: 'chat',
        resourceId: '77',
        metadata: {
          viewType: 'messages',
          page: 1,
          pageSize: 20,
        },
      }),
    );
    expect(result).toBe(maskedResult);
  });
});
