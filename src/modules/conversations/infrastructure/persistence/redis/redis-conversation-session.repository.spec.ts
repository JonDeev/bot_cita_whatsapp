import { RedisService } from '../../../../../shared/infrastructure/redis/redis.service';
import { ConversationConfigService } from '../../../application/services/conversation-config.service';
import { RedisConversationSessionRepository } from './redis-conversation-session.repository';

describe('RedisConversationSessionRepository', () => {
  it('stores serialized sessions with configured ttl', async () => {
    const redisService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    } as unknown as RedisService;
    const conversationConfigService = {
      getSessionTtlSeconds: jest.fn().mockReturnValue(7200),
    } as unknown as ConversationConfigService;

    const repository = new RedisConversationSessionRepository(
      redisService,
      conversationConfigService,
    );

    await repository.save({
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'MAIN_MENU',
      status: 'BOT_ACTIVE',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z',
    });

    expect(redisService.set).toHaveBeenCalledWith(
      'conversations:session:whatsapp:123:573001112233',
      expect.any(String),
      7200,
    );
  });
});
