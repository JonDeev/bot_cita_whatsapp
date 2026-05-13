import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotConversationPersistenceRepository } from './prisma-bot-conversation-persistence.repository';

describe('PrismaBotConversationPersistenceRepository', () => {
  it('restores a persisted conversation snapshot including context', async () => {
    const prismaBot = {
      botConversation: {
        findUnique: jest.fn().mockResolvedValue({
          conversationKey: 'whatsapp:123:573001112233',
          participantPhone: '573001112233',
          phoneNumberId: '123',
          state: 'WAITING_DOCUMENT',
          status: 'BOT_ACTIVE',
          context: {
            flowIntent: 'REQUEST_APPOINTMENT',
          },
          createdAt: new Date('2026-05-04T10:00:00.000Z'),
          updatedAt: new Date('2026-05-04T10:01:00.000Z'),
        }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationPersistenceRepository(
      prismaBot,
    );

    await expect(
      repository.findByKey('whatsapp:123:573001112233'),
    ).resolves.toMatchObject({
      state: 'WAITING_DOCUMENT',
      context: {
        flowIntent: 'REQUEST_APPOINTMENT',
      },
    });
  });

  it('upserts the conversation snapshot into bot_conversations', async () => {
    const prismaBot = {
      botConversation: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationPersistenceRepository(
      prismaBot,
    );

    await repository.upsert({
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'MAIN_MENU',
      status: 'BOT_ACTIVE',
      context: {
        flowIntent: 'REQUEST_APPOINTMENT',
      },
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:01:00.000Z',
    });

    expect(prismaBot.botConversation.upsert).toHaveBeenCalledTimes(1);
  });
});
