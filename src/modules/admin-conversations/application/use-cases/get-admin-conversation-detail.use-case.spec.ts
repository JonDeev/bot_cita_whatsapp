import { NotFoundException } from '@nestjs/common';
import { GetAdminConversationDetailUseCase } from './get-admin-conversation-detail.use-case';
import type { AdminConversationsRepository } from '../../domain/ports/admin-conversations.repository';

describe('GetAdminConversationDetailUseCase', () => {
  it('writes standardized audit event without sensitive conversation key metadata', async () => {
    const repository: jest.Mocked<AdminConversationsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn().mockResolvedValue({
        id: 10,
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        status: 'BOT_ACTIVE',
        state: 'MAIN_MENU',
        lastInboundAtIso: null,
        idleExpiresAtIso: null,
        createdAtIso: '2026-05-27T10:00:00.000Z',
        updatedAtIso: '2026-05-27T11:00:00.000Z',
      }),
      listConversationMessages: jest.fn(),
    };
    const masking = {
      mapConversationList: jest.fn(),
      mapConversationDetail: jest.fn().mockReturnValue({
        id: 10,
      }),
      mapConversationMessages: jest.fn(),
    };
    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new GetAdminConversationDetailUseCase(
      repository,
      masking as never,
      audit as never,
    );

    await useCase.execute(3, 'SUPERVISOR', 10);

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 3,
        action: 'admin.conversation.viewed',
        resourceType: 'conversation',
        resourceId: '10',
        metadata: {
          viewType: 'detail',
        },
      }),
    );
    expect(masking.mapConversationDetail).toHaveBeenCalledWith(
      'SUPERVISOR',
      expect.objectContaining({
        id: 10,
      }),
    );
  });

  it('throws NotFoundException when conversation does not exist', async () => {
    const repository: jest.Mocked<AdminConversationsRepository> = {
      listConversations: jest.fn(),
      findConversationById: jest.fn().mockResolvedValue(null),
      listConversationMessages: jest.fn(),
    };

    const useCase = new GetAdminConversationDetailUseCase(
      repository,
      {
        mapConversationList: jest.fn(),
        mapConversationDetail: jest.fn(),
        mapConversationMessages: jest.fn(),
      } as never,
      { write: jest.fn() } as never,
    );

    await expect(useCase.execute(7, 'ADMIN', 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
