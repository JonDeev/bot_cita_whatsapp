import { ListAdminConversationMessagesUseCase } from './list-admin-conversation-messages.use-case';
import type { AdminConversationsRepository } from '../../domain/ports/admin-conversations.repository';

describe('ListAdminConversationMessagesUseCase', () => {
  it('writes standardized audit event with messages view type', async () => {
    const repository: jest.Mocked<AdminConversationsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn(),
      listConversationMessages: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
    };
    const masking = {
      mapConversationList: jest.fn(),
      mapConversationDetail: jest.fn(),
      mapConversationMessages: jest.fn().mockReturnValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ListAdminConversationMessagesUseCase(
      repository,
      masking as never,
      audit as never,
    );

    await useCase.execute(9, 'SUPERVISOR', {
      conversationId: 88,
      page: 1,
      pageSize: 20,
    });

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 9,
        action: 'admin.conversation.viewed',
        resourceType: 'conversation',
        resourceId: '88',
        metadata: {
          viewType: 'messages',
          page: 1,
          pageSize: 20,
        },
      }),
    );
  });
});
