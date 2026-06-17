import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import { DispatchHalfHourlySatisfactionSurveysUseCase } from '../../application/use-cases/dispatch-half-hourly-satisfaction-surveys.use-case';
import { SatisfactionSurveyDispatchWindowService } from '../../application/services/satisfaction-survey-dispatch-window.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../../application/services/satisfaction-survey-runtime-settings-resolver.service';

@Injectable()
export class SatisfactionSurveyDispatchScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    SatisfactionSurveyDispatchScheduler.name,
  );
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dispatchUseCase: DispatchHalfHourlySatisfactionSurveysUseCase,
    private readonly dispatchWindowService: SatisfactionSurveyDispatchWindowService,
    private readonly redisService: RedisService,
    private readonly runtimeSettingsResolver: SatisfactionSurveyRuntimeSettingsResolverService,
  ) {}

  async onModuleInit(): Promise<void> {
    const runtimeSettings =
      await this.runtimeSettingsResolver.resolveStoredSnapshot();

    if (!runtimeSettings.schedulerLoopEnabled) {
      this.logger.log(
        'Half-hourly satisfaction survey dispatcher is disabled by configuration.',
      );
      return;
    }

    const intervalMs = runtimeSettings.tickIntervalMs;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    this.logger.log(
      `Half-hourly satisfaction survey dispatcher started with interval ${intervalMs}ms.`,
    );

    void this.tick();
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    const now = new Date();
    const runtimeSettings =
      await this.runtimeSettingsResolver.resolveStoredSnapshot();

    const windowResult = this.dispatchWindowService.resolveForRunAt(
      now,
      runtimeSettings.scheduleProfile,
      runtimeSettings.expirationHours,
    );
    if (!windowResult.shouldRun || !windowResult.window) {
      return;
    }

    const slotId = `${windowResult.window.surveyDateIso}:${windowResult.window.windowEndHHmm}`;
    const lockKey = `survey:dispatch:half-hourly:${slotId}`;

    const lockAcquired = await this.redisService.setIfAbsent(
      lockKey,
      now.toISOString(),
      runtimeSettings.slotLockTtlSeconds,
    );

    if (!lockAcquired) {
      return;
    }

    try {
      const result = await this.dispatchUseCase.execute({
        runAtIso: now.toISOString(),
      });

      this.logger.log(
        `Survey half-hour batch executed for ${slotId}. eligible=${result.eligibleAppointments} sent=${result.sentDispatches} failed=${result.failedDispatches}.`,
      );
    } catch (error) {
      this.logger.error(
        `Survey half-hour batch failed for ${slotId}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
