import { Injectable } from '@nestjs/common';
import type { SatisfactionSurveyRuntimeSettingsSnapshot } from '../../domain/satisfaction-survey-runtime.types';

@Injectable()
export class SatisfactionSurveyDispatchSchedulerConfigService {
  getRuntimeSettingsSnapshot(): SatisfactionSurveyRuntimeSettingsSnapshot {
    return {
      sendMode: this.getSelectValue('SURVEYS_RUNTIME_SEND_MODE', ['mock', 'live'], 'mock'),
      sendRolloutPercent: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_SEND_ROLLOUT_PERCENT',
        ['0', '5', '10', '25', '50', '75', '100'],
        '0',
      ),
      emergencyPauseEnabled: this.getBooleanSelectValue(
        'SURVEYS_RUNTIME_EMERGENCY_PAUSE_ENABLED',
        false,
      ),
      dispatchEnabled: this.getBooleanSelectValue(
        'SURVEYS_RUNTIME_DISPATCH_ENABLED',
        true,
      ),
      eligibilityLimit: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_ELIGIBILITY_LIMIT',
        ['100', '250', '500', '1000'],
        '500',
      ),
      expirationHours: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_EXPIRATION_HOURS',
        ['12', '24', '36', '48'],
        '24',
      ),
      scheduleProfile: this.getSelectValue(
        'SURVEYS_RUNTIME_SCHEDULE_PROFILE',
        [
          'business_hours_mon_fri',
          'extended_hours_mon_fri',
          'business_hours_mon_sat',
        ],
        'business_hours_mon_fri',
      ),
      schedulerLoopEnabled: this.getBooleanSelectValue(
        'SURVEYS_RUNTIME_SCHEDULER_LOOP_ENABLED',
        true,
      ),
      tickIntervalMs: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_TICK_INTERVAL_MS',
        ['30000', '60000', '300000'],
        '60000',
      ),
      slotLockTtlSeconds: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_SLOT_LOCK_TTL_SECONDS',
        ['1200', '1800', '2100', '2700'],
        '2100',
      ),
      maxDispatchesPerRun: this.getNumericSelectValue(
        'SURVEYS_RUNTIME_MAX_DISPATCHES_PER_RUN',
        ['25', '50', '100', '200'],
        '50',
      ),
    };
  }

  isEnabled(): boolean {
    return this.getRuntimeSettingsSnapshot().schedulerLoopEnabled;
  }

  getTickIntervalMs(): number {
    return this.getRuntimeSettingsSnapshot().tickIntervalMs;
  }

  getSlotLockTtlSeconds(): number {
    return this.getRuntimeSettingsSnapshot().slotLockTtlSeconds;
  }

  private getBooleanSelectValue(key: string, fallback: boolean): boolean {
    const value = (process.env[key] ?? '').trim().toLowerCase();
    if (!value) {
      return fallback;
    }

    if (value === 'true' || value === 'enabled') {
      return true;
    }

    if (value === 'false' || value === 'disabled') {
      return false;
    }

    return fallback;
  }

  private getNumericSelectValue<T extends string>(
    key: string,
    allowedValues: readonly T[],
    fallback: T,
  ): number {
    const value = (process.env[key] ?? '').trim();
    if (!value) {
      return Number(fallback);
    }

    if (!allowedValues.includes(value as T)) {
      return Number(fallback);
    }

    return Number(value);
  }

  private getSelectValue<T extends string>(
    key: string,
    allowedValues: readonly T[],
    fallback: T,
  ): T {
    const value = (process.env[key] ?? '').trim();
    if (!value) {
      return fallback;
    }

    return allowedValues.includes(value as T) ? (value as T) : fallback;
  }
}
