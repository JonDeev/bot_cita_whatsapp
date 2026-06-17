import { Injectable } from '@nestjs/common';
import type { AdminRole, SurveyRuntimeSettingsOptionsDto } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { GetSatisfactionSurveyRuntimeOptionsUseCase } from '../../../surveys/application/use-cases/get-satisfaction-survey-runtime-options.use-case';

@Injectable()
export class GetAdminSurveyRuntimeOptionsUseCase {
  constructor(
    private readonly getRuntimeOptions: GetSatisfactionSurveyRuntimeOptionsUseCase,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
  ): Promise<SurveyRuntimeSettingsOptionsDto> {
    const result = this.getRuntimeOptions.execute();

    await this.audit.write({
      adminUserId,
      action: 'admin.surveys.settings_options_viewed',
      resourceType: 'satisfaction_survey_runtime_settings',
      resourceId: 'default',
      metadata: {
        role,
      },
    });

    return result;
  }
}
