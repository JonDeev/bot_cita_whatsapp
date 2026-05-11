import { Injectable } from '@nestjs/common';

@Injectable()
export class SatisfactionSurveyDispatchSchedulerConfigService {
  isEnabled(): boolean {
    return this.readBooleanEnv('SURVEYS_HALF_HOURLY_DISPATCH_ENABLED', false);
  }

  getTickIntervalMs(): number {
    return this.readPositiveIntEnv('SURVEYS_HALF_HOURLY_DISPATCH_INTERVAL_MS', 60_000);
  }

  getSlotLockTtlSeconds(): number {
    return this.readPositiveIntEnv('SURVEYS_HALF_HOURLY_DISPATCH_LOCK_TTL_SECONDS', 2_100);
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
