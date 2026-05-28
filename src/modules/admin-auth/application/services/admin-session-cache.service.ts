import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import type { AdminSessionContext } from '../../domain/admin-auth.types';

const ADMIN_SESSION_CACHE_KEY_PREFIX = 'admin:session:';

interface CachedAdminSessionPayload {
  sessionId: number;
  userId: number;
  role: AdminSessionContext['user']['role'];
  status: AdminSessionContext['user']['status'];
  email: string;
  username: string;
  displayName: string;
  csrfTokenHash: string | null;
  expiresAtIso: string;
}

@Injectable()
export class AdminSessionCacheService {
  constructor(private readonly redis: RedisService) {}

  async get(
    sessionTokenHash: string,
  ): Promise<CachedAdminSessionPayload | null> {
    const raw = await this.redis.get(this.key(sessionTokenHash));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CachedAdminSessionPayload;
      if (
        typeof parsed !== 'object' ||
        parsed == null ||
        typeof parsed.sessionId !== 'number' ||
        typeof parsed.userId !== 'number' ||
        typeof parsed.expiresAtIso !== 'string'
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  async set(
    sessionTokenHash: string,
    payload: CachedAdminSessionPayload,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      this.key(sessionTokenHash),
      JSON.stringify(payload),
      ttlSeconds,
    );
  }

  async delete(sessionTokenHash: string): Promise<void> {
    await this.redis.delete(this.key(sessionTokenHash));
  }

  private key(sessionTokenHash: string): string {
    return `${ADMIN_SESSION_CACHE_KEY_PREFIX}${sessionTokenHash}`;
  }
}
