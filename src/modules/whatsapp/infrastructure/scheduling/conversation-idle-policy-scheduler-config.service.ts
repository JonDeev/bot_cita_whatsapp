import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationIdlePolicySchedulerConfigService {
  getTickIntervalMs(): number {
    return this.readPositiveIntEnv(
      'CONVERSATION_IDLE_POLICY_TICK_INTERVAL_MS',
      60_000,
    );
  }

  getLockTtlSeconds(): number {
    return this.readPositiveIntEnv(
      'CONVERSATION_IDLE_POLICY_LOCK_TTL_SECONDS',
      55,
    );
  }

  private readPositiveIntEnv(key: string, fallback: number): number {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }
}
