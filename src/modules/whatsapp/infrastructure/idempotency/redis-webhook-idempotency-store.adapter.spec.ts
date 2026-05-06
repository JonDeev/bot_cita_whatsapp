import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import { RedisWebhookIdempotencyStoreAdapter } from './redis-webhook-idempotency-store.adapter';

describe('RedisWebhookIdempotencyStoreAdapter', () => {
  it('stores keys with redis prefix and ttl', async () => {
    const redisService = {
      setIfAbsent: jest.fn().mockResolvedValue(true),
    } as unknown as RedisService;

    const adapter = new RedisWebhookIdempotencyStoreAdapter(redisService);
    const acquired = await adapter.tryAcquire('incoming:wamid-1', 3600);

    expect(acquired).toBe(true);
    expect(redisService.setIfAbsent).toHaveBeenCalledWith(
      'whatsapp:webhook:idempotency:incoming:wamid-1',
      '1',
      3600,
    );
  });
});
