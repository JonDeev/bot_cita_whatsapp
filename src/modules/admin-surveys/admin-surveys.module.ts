import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SurveysModule } from '../surveys/surveys.module';
import { AdminSurveysMaskingService } from './application/services/admin-surveys-masking.service';
import { AdminSurveysQueryParserService } from './application/services/admin-surveys-query-parser.service';
import { GetAdminSurveyMetricsUseCase } from './application/use-cases/get-admin-survey-metrics.use-case';
import { GetAdminSurveyRuntimeOptionsUseCase } from './application/use-cases/get-admin-survey-runtime-options.use-case';
import { GetAdminSurveyRuntimeSettingsUseCase } from './application/use-cases/get-admin-survey-runtime-settings.use-case';
import { ListAdminSurveyDispatchesUseCase } from './application/use-cases/list-admin-survey-dispatches.use-case';
import { ListAdminSurveyRuntimeSettingHistoryUseCase } from './application/use-cases/list-admin-survey-runtime-setting-history.use-case';
import { ToggleAdminSurveyEmergencyPauseUseCase } from './application/use-cases/toggle-admin-survey-emergency-pause.use-case';
import { UpdateAdminSurveyRuntimeSettingsUseCase } from './application/use-cases/update-admin-survey-runtime-settings.use-case';
import { ADMIN_SURVEYS_REPOSITORY } from './domain/admin-surveys.tokens';
import { PrismaBotAdminSurveysRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-surveys.repository';
import { AdminSurveysController } from './presentation/http/admin-surveys.controller';

@Module({
  imports: [PrismaBotModule, AdminAuthModule, SurveysModule],
  controllers: [AdminSurveysController],
  providers: [
    AdminSurveysMaskingService,
    AdminSurveysQueryParserService,
    GetAdminSurveyMetricsUseCase,
    ListAdminSurveyDispatchesUseCase,
    GetAdminSurveyRuntimeSettingsUseCase,
    GetAdminSurveyRuntimeOptionsUseCase,
    ListAdminSurveyRuntimeSettingHistoryUseCase,
    UpdateAdminSurveyRuntimeSettingsUseCase,
    ToggleAdminSurveyEmergencyPauseUseCase,
    {
      provide: ADMIN_SURVEYS_REPOSITORY,
      useClass: PrismaBotAdminSurveysRepository,
    },
  ],
})
export class AdminSurveysModule {}
