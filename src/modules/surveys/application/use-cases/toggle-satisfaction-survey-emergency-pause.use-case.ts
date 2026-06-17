import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AdminRole,
  SurveyBooleanSelectValue,
  SurveyRuntimeSettingsDto,
} from '@whatsapp-bot/shared';
import {
  SATISFACTION_SURVEY_RUNTIME_CHANGE_TYPE_BY_EMERGENCY_PAUSE,
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../domain/satisfaction-survey-runtime.types';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/surveys.tokens';
import type { SatisfactionSurveyRuntimeSettingsRepository } from '../../domain/ports/satisfaction-survey-runtime-settings.repository';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from '../services/satisfaction-survey-runtime-settings-catalog.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';

export interface ToggleSatisfactionSurveyEmergencyPauseInput {
  adminUserId: number;
  adminRole: AdminRole;
  expectedVersion: number;
  reason: string;
  emergencyPauseEnabled: SurveyBooleanSelectValue;
}

@Injectable()
export class ToggleSatisfactionSurveyEmergencyPauseUseCase {
  constructor(
    @Inject(SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: SatisfactionSurveyRuntimeSettingsRepository,
    private readonly resolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  async execute(
    input: ToggleSatisfactionSurveyEmergencyPauseInput,
  ): Promise<SurveyRuntimeSettingsDto> {
    if (!this.catalog.isEditableByRole('emergencyPauseEnabled', input.adminRole)) {
      throw new ForbiddenException(
        `Role ${input.adminRole} cannot toggle the survey emergency pause.`,
      );
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('A reason is required to toggle the pause.');
    }

    const storedSnapshot = await this.resolver.resolveStoredSnapshot();
    if (
      (storedSnapshot.emergencyPauseEnabled && input.emergencyPauseEnabled === 'enabled') ||
      (!storedSnapshot.emergencyPauseEnabled && input.emergencyPauseEnabled === 'disabled')
    ) {
      throw new BadRequestException(
        'The survey emergency pause already has the requested value.',
      );
    }

    const nextSnapshot = {
      ...storedSnapshot,
      emergencyPauseEnabled: input.emergencyPauseEnabled === 'enabled',
    };

    const result = await this.repository.saveWithEvent({
      scopeKey: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: input.expectedVersion,
      nextSnapshot,
      effectiveSnapshot: nextSnapshot,
      adminUserId: input.adminUserId,
      changeType:
        SATISFACTION_SURVEY_RUNTIME_CHANGE_TYPE_BY_EMERGENCY_PAUSE[
          input.emergencyPauseEnabled === 'enabled' ? 'true' : 'false'
        ],
      section: 'primary',
      reason,
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: 'admin.surveys.emergency_pause_toggled',
        resourceType: 'satisfaction_survey_runtime_settings',
        resourceId: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          role: input.adminRole,
          enabled: input.emergencyPauseEnabled === 'enabled',
          reasonProvided: true,
          expectedVersion: input.expectedVersion,
        },
        ipHash: null,
      },
    });

    if (!result) {
      throw new ConflictException(
        'Survey emergency pause changed before this update completed.',
      );
    }

    const view = await this.resolver.resolveRuntimeView();
    return {
      ...view,
      permissions: this.catalog.getPermissionsForRole(input.adminRole),
    };
  }
}
