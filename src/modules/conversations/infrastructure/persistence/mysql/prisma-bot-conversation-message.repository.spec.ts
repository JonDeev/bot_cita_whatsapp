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
        findFirst: jest.fn().mockResolvedValue(null),
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
      contextMessageId: null,
      providerTimestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
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
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'interactive',
      to: '573001112233',
      whatsappMessageId: 'wamid.out.1',
      body: 'menu',
      sentAt: '2026-05-07T12:44:18.000Z',
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledTimes(1);
    expect(prismaBot.botMessage.create).not.toHaveBeenCalled();
  });

  it('checks whether an outbound message id is known for the conversation', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 99 }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await expect(
      repository.hasKnownOutboundMessage(
        'whatsapp:123:573001112233',
        'wamid.out.1',
      ),
    ).resolves.toBe(true);
  });

  it('resolves outbound message occurredAt for known context id', async () => {
    const occurredAt = new Date('2026-05-22T12:41:18.160Z');
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ occurredAt }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await expect(
      repository.findOutboundMessageOccurredAt?.(
        'whatsapp:123:573001112233',
        'wamid.out.1',
      ),
    ).resolves.toBe('2026-05-22T12:41:18.160Z');
  });
});
