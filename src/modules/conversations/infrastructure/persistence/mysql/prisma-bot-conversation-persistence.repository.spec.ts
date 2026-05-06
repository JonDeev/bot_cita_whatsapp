import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotConversationPersistenceRepository } from './prisma-bot-conversation-persistence.repository';

describe('PrismaBotConversationPersistenceRepository', () => {
  it('upserts the conversation snapshot into bot_conversations', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationPersistenceRepository(prismaBot);

    await repository.upsert({
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'MAIN_MENU',
      status: 'BOT_ACTIVE',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:01:00.000Z',
    });

    expect(prismaBot.botConversation.upsert).toHaveBeenCalledTimes(1);
  });
});
