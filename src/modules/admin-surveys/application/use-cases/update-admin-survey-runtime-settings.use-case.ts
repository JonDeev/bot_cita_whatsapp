import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  SurveyRuntimeSettingsDto,
  SurveyRuntimeSettingsUpdateRequestDto,
} from '@whatsapp-bot/shared';
import { UpdateSatisfactionSurveyRuntimeSettingsUseCase } from '../../../surveys/application/use-cases/update-satisfaction-survey-runtime-settings.use-case';

@Injectable()
export class UpdateAdminSurveyRuntimeSettingsUseCase {
  constructor(
    private readonly updateRuntimeSettings: UpdateSatisfactionSurveyRuntimeSettingsUseCase,
  ) {}

  execute(input: {
    adminUserId: number;
    adminRole: AdminRole;
    ipHash?: string | null;
    request: SurveyRuntimeSettingsUpdateRequestDto;
  }): Promise<SurveyRuntimeSettingsDto> {
    return this.updateRuntimeSettings.execute({
      adminUserId: input.adminUserId,
      adminRole: input.adminRole,
      expectedVersion: input.request.expectedVersion,
      reason: input.request.reason,
      changes: input.request.changes,
    });
  }
}
