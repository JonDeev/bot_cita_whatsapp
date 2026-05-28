import { ListAdminConversationsUseCase } from './list-admin-conversations.use-case';
import type { AdminConversationsRepository } from '../../domain/ports/admin-conversations.repository';

describe('ListAdminConversationsUseCase', () => {
  it('writes standardized audit event with list view type', async () => {
    const repository: jest.Mocked<AdminConversationsRepository> = {
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
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ListAdminConversationsUseCase(
      repository,
      masking as never,
      audit as never,
    );

    await useCase.execute(5, 'ADMIN', {
      page: 1,
      pageSize: 20,
      status: 'BOT_ACTIVE',
    });

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 5,
        action: 'admin.conversation.viewed',
        resourceType: 'conversation',
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
