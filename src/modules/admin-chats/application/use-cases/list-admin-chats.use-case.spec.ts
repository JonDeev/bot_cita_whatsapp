import { ListAdminChatsUseCase } from './list-admin-chats.use-case';
import type { AdminChatsRepository } from '../../domain/ports/admin-chats.repository';

describe('ListAdminChatsUseCase', () => {
  it('writes standardized audit event with list view type', async () => {
    const repository: jest.Mocked<AdminChatsRepository> = {
      listConversations: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
      findConversationById: jest.fn(),
      listConversationMessages: jest.fn(),
    };
    const masking = {
      mapConversationList: jest.fn().mockReturnValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
      mapConversationDetail: jest.fn(),
      mapConversationMessages: jest.fn(),
    };
    const mapper = {
      mapChatList: jest.fn().mockReturnValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
      mapChatDetail: jest.fn(),
      mapChatMessages: jest.fn(),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ListAdminChatsUseCase(
      repository,
      masking as never,
      mapper as never,
      audit as never,
    );

    await useCase.execute(11, 'SUPERVISOR', {
      page: 1,
      pageSize: 20,
      status: 'BOT_ACTIVE',
      participantPhoneContains: null,
      fromIso: null,
      toIso: null,
    });

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 11,
        action: 'admin.chat.viewed',
        resourceType: 'chat',
        metadata: {
          viewType: 'list',
          page: 1,
          pageSize: 20,
          status: 'BOT_ACTIVE',
        },
      }),
    );
  });
});
