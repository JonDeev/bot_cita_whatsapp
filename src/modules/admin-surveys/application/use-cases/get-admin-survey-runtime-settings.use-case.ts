import { Injectable } from '@nestjs/common';
import type { AdminRole, SurveyRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { GetSatisfactionSurveyRuntimeSettingsUseCase } from '../../../surveys/application/use-cases/get-satisfaction-survey-runtime-settings.use-case';

@Injectable()
export class GetAdminSurveyRuntimeSettingsUseCase {
  constructor(
    private readonly getRuntimeSettings: GetSatisfactionSurveyRuntimeSettingsUseCase,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
  ): Promise<SurveyRuntimeSettingsDto> {
    const result = await this.getRuntimeSettings.execute(role);

    await this.audit.write({
      adminUserId,
      action: 'admin.surveys.settings_viewed',
      resourceType: 'satisfaction_survey_runtime_settings',
      resourceId: 'default',
      metadata: {
        role,
        version: result.metadata.version,
      },
    });

    return result;
  }
}
