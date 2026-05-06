import { Injectable } from '@nestjs/common';
import { WebhookIdempotencyStorePort } from '../../domain/ports/webhook-idempotency-store.port';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';

@Injectable()
export class RedisWebhookIdempotencyStoreAdapter implements WebhookIdempotencyStorePort {
  private static readonly KEY_PREFIX = 'whatsapp:webhook:idempotency:';

  constructor(private readonly redisService: RedisService) {}

  async tryAcquire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.redisService.setIfAbsent(
      `${RedisWebhookIdempotencyStoreAdapter.KEY_PREFIX}${key}`,
      '1',
      ttlSeconds,
    );
  }
}
