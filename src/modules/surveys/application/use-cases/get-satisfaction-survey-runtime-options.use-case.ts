import { Injectable } from '@nestjs/common';
import type { SurveyRuntimeSettingsOptionsDto } from '@whatsapp-bot/shared';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from '../services/satisfaction-survey-runtime-settings-catalog.service';

@Injectable()
export class GetSatisfactionSurveyRuntimeOptionsUseCase {
  constructor(
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  execute(): SurveyRuntimeSettingsOptionsDto {
    return this.catalog.getOptions();
  }
}
