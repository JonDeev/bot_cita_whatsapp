import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES,
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../domain/satisfaction-survey-runtime.types';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/surveys.tokens';
import type { SatisfactionSurveyRuntimeSettingsRepository } from '../../domain/ports/satisfaction-survey-runtime-settings.repository';
import { SatisfactionSurveyDispatchSchedulerConfigService } from '../../infrastructure/scheduling/satisfaction-survey-dispatch-scheduler-config.service';

@Injectable()
export class SatisfactionSurveyRuntimeSettingsInitializerService
  implements OnModuleInit
{
  private readonly logger = new Logger(
    SatisfactionSurveyRuntimeSettingsInitializerService.name,
  );

  constructor(
    @Inject(SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: SatisfactionSurveyRuntimeSettingsRepository,
    private readonly bootstrap: SatisfactionSurveyDispatchSchedulerConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.repository.findByScope(
      SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
    );

    if (existing) {
      return;
    }

    const snapshot = this.bootstrap.getRuntimeSettingsSnapshot();
    const seeded = await this.repository.saveWithEvent({
      scopeKey: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 0,
      nextSnapshot: snapshot,
      effectiveSnapshot: snapshot,
      adminUserId: null,
      changeType:
        SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
      section: 'protected',
      reason: 'bootstrap',
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: 'system.surveys_runtime_settings.defaults_seeded',
        resourceType: 'satisfaction_survey_runtime_settings',
        resourceId: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          source: 'bootstrap',
          seededVersion: 1,
        },
        ipHash: null,
      },
    });

    if (!seeded) {
      this.logger.log(
        'Survey runtime settings were seeded by another concurrent instance.',
      );
      return;
    }

    this.logger.log(
      `Seeded survey runtime settings scope=${seeded.settings.scopeKey} version=${seeded.settings.version}.`,
    );
  }
}
