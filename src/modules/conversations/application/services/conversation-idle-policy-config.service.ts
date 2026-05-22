import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationIdlePolicyConfigService {
  isEnabled(): boolean {
    return this.readBooleanEnv('CONVERSATION_IDLE_POLICY_ENABLED', true);
  }

  getReminderAfterMinutes(): number {
    return this.readPositiveIntEnv('CONVERSATION_IDLE_REMINDER_MINUTES', 15);
  }

  getExpireAfterMinutes(): number {
    return this.readPositiveIntEnv('CONVERSATION_IDLE_EXPIRE_MINUTES', 20);
  }

  getSchedulerTickIntervalMs(): number {
    return this.readPositiveIntEnv(
      'CONVERSATION_IDLE_POLICY_TICK_INTERVAL_MS',
      60_000,
    );
  }

  getBatchSize(): number {
    return this.readPositiveIntEnv('CONVERSATION_IDLE_POLICY_BATCH_SIZE', 100);
  }

  private readBooleanEnv(key: string, fallback: boolean): boolean {
    const value = (process.env[key] ?? '').trim().toLowerCase();
    if (!value) {
      return fallback;
    }

    return value === 'true';
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
