import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import { AdminAuthConfigService } from './admin-auth-config.service';

const LOGIN_THROTTLE_IP_PREFIX = 'admin:auth:throttle:ip:';
const LOGIN_THROTTLE_IDENTIFIER_PREFIX = 'admin:auth:throttle:identifier:';

@Injectable()
export class AdminLoginThrottleService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AdminAuthConfigService,
  ) {}

  async isBlocked(ipKey: string, identifierKey: string): Promise<boolean> {
    const [ipRaw, identifierRaw] = await Promise.all([
      this.redis.get(this.ipKey(ipKey)),
      this.redis.get(this.identifierKey(identifierKey)),
    ]);

    const ipAttempts = this.safeParseInt(ipRaw);
    const identifierAttempts = this.safeParseInt(identifierRaw);

    return (
      ipAttempts >= this.config.getMaxFailedAttemptsPerIp() ||
      identifierAttempts >= this.config.getMaxFailedAttemptsPerIdentifier()
    );
  }

  async recordFailure(ipKey: string, identifierKey: string): Promise<void> {
    const ttlSeconds = this.config.getThrottleWindowSeconds();
    await Promise.all([
      this.redis.increment(this.ipKey(ipKey), ttlSeconds),
      this.redis.increment(this.identifierKey(identifierKey), ttlSeconds),
    ]);
  }

  async clear(ipKey: string, identifierKey: string): Promise<void> {
    await Promise.all([
      this.redis.delete(this.ipKey(ipKey)),
      this.redis.delete(this.identifierKey(identifierKey)),
    ]);
  }

  private ipKey(value: string): string {
    return `${LOGIN_THROTTLE_IP_PREFIX}${value}`;
  }

  private identifierKey(value: string): string {
    return `${LOGIN_THROTTLE_IDENTIFIER_PREFIX}${value}`;
  }

  private safeParseInt(raw: string | null): number {
    if (!raw) {
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}
