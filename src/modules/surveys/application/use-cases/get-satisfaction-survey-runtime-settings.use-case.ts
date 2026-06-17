import { Injectable } from '@nestjs/common';
import type { AdminRole, SurveyRuntimeSettingsDto } from '@whatsapp-bot/shared';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from '../services/satisfaction-survey-runtime-settings-catalog.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';

@Injectable()
export class GetSatisfactionSurveyRuntimeSettingsUseCase {
  constructor(
    private readonly resolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  async execute(adminRole: AdminRole): Promise<SurveyRuntimeSettingsDto> {
    const view = await this.resolver.resolveRuntimeView();

    return {
      ...view,
      permissions: this.catalog.getPermissionsForRole(adminRole),
    };
  }
}
