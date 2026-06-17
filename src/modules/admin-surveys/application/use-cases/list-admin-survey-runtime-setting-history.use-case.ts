import { Injectable } from '@nestjs/common';
import type {
  AdminRole,
  SurveyRuntimeSettingHistoryResultDto,
} from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ListSatisfactionSurveyRuntimeSettingEventsUseCase } from '../../../surveys/application/use-cases/list-satisfaction-survey-runtime-setting-events.use-case';

export interface ListAdminSurveyRuntimeSettingHistoryQuery {
  limit: number;
}

@Injectable()
export class ListAdminSurveyRuntimeSettingHistoryUseCase {
  constructor(
    private readonly listHistory: ListSatisfactionSurveyRuntimeSettingEventsUseCase,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminSurveyRuntimeSettingHistoryQuery,
  ): Promise<SurveyRuntimeSettingHistoryResultDto> {
    const result = await this.listHistory.execute({
      limit: query.limit,
    });

    await this.audit.write({
      adminUserId,
      action: 'admin.surveys.settings_history_viewed',
      resourceType: 'satisfaction_survey_runtime_settings',
      resourceId: 'default',
      metadata: {
        role,
        limit: query.limit,
      },
    });

    return result;
  }
}
