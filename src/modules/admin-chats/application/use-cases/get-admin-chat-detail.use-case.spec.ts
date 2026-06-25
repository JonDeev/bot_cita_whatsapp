import { NotFoundException } from '@nestjs/common';
import { GetAdminChatDetailUseCase } from './get-admin-chat-detail.use-case';
import type { AdminChatsRepository } from '../../domain/ports/admin-chats.repository';

describe('GetAdminChatDetailUseCase', () => {
  it('maps the raw conversation detail after writing audit metadata', async () => {
    const conversation = {
      id: 25,
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
    const repository: jest.Mocked<AdminChatsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn().mockResolvedValue(conversation),
      listConversationMessages: jest.fn(),
    };
    const mapper = {
      mapChatList: jest.fn(),
      mapChatDetail: jest.fn().mockReturnValue({
        id: conversation.id,
        participantPhone: conversation.participantPhone,
      }),
      mapChatMessages: jest.fn(),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new GetAdminChatDetailUseCase(
      repository,
      mapper as never,
      audit as never,
    );

    await useCase.execute(7, 'SUPERVISOR', 25);

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 7,
        action: 'admin.chat.viewed',
        resourceType: 'chat',
        resourceId: '25',
        metadata: {
          viewType: 'detail',
        },
      }),
    );
    expect(mapper.mapChatDetail).toHaveBeenCalledWith(conversation);
  });

  it('throws not found when the chat does not exist', async () => {
    const repository: jest.Mocked<AdminChatsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn().mockResolvedValue(null),
      listConversationMessages: jest.fn(),
    };
    const mapper = {
      mapChatList: jest.fn(),
      mapChatDetail: jest.fn(),
      mapChatMessages: jest.fn(),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new GetAdminChatDetailUseCase(
      repository,
      mapper as never,
      audit as never,
    );

    await expect(useCase.execute(7, 'ADMIN', 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.write).not.toHaveBeenCalled();
    expect(mapper.mapChatDetail).not.toHaveBeenCalled();
  });
});
