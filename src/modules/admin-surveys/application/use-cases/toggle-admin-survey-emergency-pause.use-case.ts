import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  SurveyEmergencyPauseUpdateRequestDto,
  SurveyRuntimeSettingsDto,
} from '@whatsapp-bot/shared';
import { ToggleSatisfactionSurveyEmergencyPauseUseCase } from '../../../surveys/application/use-cases/toggle-satisfaction-survey-emergency-pause.use-case';

@Injectable()
export class ToggleAdminSurveyEmergencyPauseUseCase {
  constructor(
    private readonly toggleEmergencyPause: ToggleSatisfactionSurveyEmergencyPauseUseCase,
  ) {}

  execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    request: SurveyEmergencyPauseUpdateRequestDto;
  }): Promise<SurveyRuntimeSettingsDto> {
    return this.toggleEmergencyPause.execute({
      adminUserId: input.adminUserId,
      adminRole: input.adminRole,
      expectedVersion: input.request.expectedVersion,
      reason: input.request.reason,
      emergencyPauseEnabled: input.request.emergencyPauseEnabled,
    });
  }
}
