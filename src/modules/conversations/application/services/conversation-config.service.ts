import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationConfigService {
  getSessionTtlSeconds(): number {
    const rawValue = process.env.CONVERSATION_SESSION_TTL_SECONDS;
    const ttlSeconds = rawValue ? Number(rawValue) : 60 * 60 * 24;

    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return 60 * 60 * 24;
    }

    return ttlSeconds;
  }
}
