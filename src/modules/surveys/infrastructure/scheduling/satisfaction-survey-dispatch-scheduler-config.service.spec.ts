import { SatisfactionSurveyDispatchSchedulerConfigService } from './satisfaction-survey-dispatch-scheduler-config.service';

describe('SatisfactionSurveyDispatchSchedulerConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses safe defaults when env vars are missing', () => {
    delete process.env.SURVEYS_RUNTIME_SCHEDULER_LOOP_ENABLED;
    delete process.env.SURVEYS_HALF_HOURLY_DISPATCH_ENABLED;
    delete process.env.SURVEYS_RUNTIME_TICK_INTERVAL_MS;
    delete process.env.SURVEYS_HALF_HOURLY_DISPATCH_INTERVAL_MS;
    delete process.env.SURVEYS_RUNTIME_SLOT_LOCK_TTL_SECONDS;
    delete process.env.SURVEYS_HALF_HOURLY_DISPATCH_LOCK_TTL_SECONDS;

    const service = new SatisfactionSurveyDispatchSchedulerConfigService();

    expect(service.isEnabled()).toBe(false);
    expect(service.getTickIntervalMs()).toBe(60_000);
    expect(service.getSlotLockTtlSeconds()).toBe(2_100);
  });

  it('reads configured values when provided', () => {
    process.env.SURVEYS_RUNTIME_SCHEDULER_LOOP_ENABLED = 'true';
    process.env.SURVEYS_HALF_HOURLY_DISPATCH_ENABLED = 'true';
    process.env.SURVEYS_RUNTIME_TICK_INTERVAL_MS = '30000';
    process.env.SURVEYS_HALF_HOURLY_DISPATCH_INTERVAL_MS = '30000';
    process.env.SURVEYS_RUNTIME_SLOT_LOCK_TTL_SECONDS = '1200';
    process.env.SURVEYS_HALF_HOURLY_DISPATCH_LOCK_TTL_SECONDS = '1200';

    const service = new SatisfactionSurveyDispatchSchedulerConfigService();

    expect(service.isEnabled()).toBe(true);
    expect(service.getTickIntervalMs()).toBe(30_000);
    expect(service.getSlotLockTtlSeconds()).toBe(1_200);
  });
});
