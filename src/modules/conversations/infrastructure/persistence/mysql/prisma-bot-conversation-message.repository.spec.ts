import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotConversationMessageRepository } from './prisma-bot-conversation-message.repository';

describe('PrismaBotConversationMessageRepository', () => {
  it('stores inbound messages as idempotent upserts', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveInbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageId: 'wamid.1',
      messageType: 'text',
      from: '573001112233',
      phoneNumberId: '123',
      textBody: 'hola',
      interactiveReplyId: null,
      interactiveReplyTitle: null,
      timestamp: '1711111111',
    });

    expect(prismaBot.botConversation.upsert).toHaveBeenCalledTimes(1);
    expect(prismaBot.botMessage.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores outbound messages with provider message id when available', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'interactive',
      to: '573001112233',
      whatsappMessageId: 'wamid.out.1',
      body: 'menu',
      timestamp: '1711111111',
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledTimes(1);
    expect(prismaBot.botMessage.create).not.toHaveBeenCalled();
  });
});
