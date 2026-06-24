import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { PatientsModule } from '../patients/patients.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '../../shared/infrastructure/redis/redis.module';
import { CreateSatisfactionSurveyDispatchUseCase } from './application/use-cases/create-satisfaction-survey-dispatch.use-case';
import { DispatchHalfHourlySatisfactionSurveysUseCase } from './application/use-cases/dispatch-half-hourly-satisfaction-surveys.use-case';
import { HandleSatisfactionSurveyPhoneVerificationReplyUseCase } from './application/use-cases/handle-satisfaction-survey-phone-verification-reply.use-case';
import { ListSatisfactionSurveyRuntimeSettingEventsUseCase } from './application/use-cases/list-satisfaction-survey-runtime-setting-events.use-case';
import { RegisterWhatsappSurveyConsentUseCase } from './application/use-cases/register-whatsapp-survey-consent.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './application/use-cases/send-satisfaction-survey-flow-invitation.use-case';
import { SendSatisfactionSurveyPhoneVerificationUseCase } from './application/use-cases/send-satisfaction-survey-phone-verification.use-case';
import { RecordSatisfactionSurveyFlowSubmissionUseCase } from './application/use-cases/record-satisfaction-survey-flow-submission.use-case';
import { RecordSatisfactionSurveyTemplateReplyUseCase } from './application/use-cases/record-satisfaction-survey-template-reply.use-case';
import { GetSatisfactionSurveyMetricsUseCase } from './application/use-cases/get-satisfaction-survey-metrics.use-case';
import { GetSatisfactionSurveyRuntimeOptionsUseCase } from './application/use-cases/get-satisfaction-survey-runtime-options.use-case';
import { GetSatisfactionSurveyRuntimeSettingsUseCase } from './application/use-cases/get-satisfaction-survey-runtime-settings.use-case';
import { ToggleSatisfactionSurveyEmergencyPauseUseCase } from './application/use-cases/toggle-satisfaction-survey-emergency-pause.use-case';
import { UpdateSatisfactionSurveyRuntimeSettingsUseCase } from './application/use-cases/update-satisfaction-survey-runtime-settings.use-case';
import { SatisfactionSurveyDispatchWindowService } from './application/services/satisfaction-survey-dispatch-window.service';
import { SatisfactionSurveyPhoneVerificationActionKeyService } from './application/services/satisfaction-survey-phone-verification-action-key.service';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from './application/services/satisfaction-survey-runtime-settings-catalog.service';
import { SatisfactionSurveyRuntimeSettingsInitializerService } from './application/services/satisfaction-survey-runtime-settings-initializer.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from './application/services/satisfaction-survey-runtime-settings-resolver.service';
import {
  SatisfactionSurveyEligibilitySourceConfigService,
  SURVEY_ELIGIBILITY_SOURCES,
} from './application/services/satisfaction-survey-eligibility-source-config.service';
import { SatisfactionSurveyFlowSubmissionFieldMapService } from './application/services/satisfaction-survey-flow-submission-field-map.service';
import { SatisfactionSurveyMetricsAccessConfigService } from './application/services/satisfaction-survey-metrics-access-config.service';
import { SurveyPhoneVerificationTemplateConfigService } from './application/services/survey-phone-verification-template-config.service';
import { SurveyFlowTemplateConfigService } from './application/services/survey-flow-template-config.service';
import { SurveyFlowTokenFactory } from './application/services/survey-flow-token.factory';
import { SurveyWhatsappPhoneNormalizerService } from './application/services/survey-whatsapp-phone-normalizer.service';
import {
  SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SATISFACTION_SURVEY_METRICS_REPOSITORY,
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
  SURVEY_DISPATCH_REPOSITORY,
  SURVEY_RECIPIENT_POLICY_REPOSITORY,
} from './domain/surveys.tokens';
import { InternalSatisfactionSurveyMetricsController } from './presentation/http/internal-satisfaction-survey-metrics.controller';
import { PrismaBotSatisfactionSurveyMetricsRepository } from './infrastructure/persistence/mysql/prisma-bot-satisfaction-survey-metrics.repository';
import { PrismaBotSatisfactionSurveyRuntimeSettingsRepository } from './infrastructure/persistence/mysql/prisma-bot-satisfaction-survey-runtime-settings.repository';
import { PrismaBotSurveyRecipientPolicyRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-recipient-policy.repository';
import { PrismaLegacySatisfactionSurveyEligibilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-eligibility.repository';
import { PrismaLegacySatisfactionSurveyLegacyStatusRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-legacy-status.repository';
import { PrismaBotSurveyDispatchRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-dispatch.repository';
import { JsonFileSatisfactionSurveyEligibilityRepository } from './infrastructure/persistence/json/json-file-satisfaction-survey-eligibility.repository';
import { SatisfactionSurveyDispatchSchedulerConfigService } from './infrastructure/scheduling/satisfaction-survey-dispatch-scheduler-config.service';
import { SatisfactionSurveyDispatchScheduler } from './infrastructure/scheduling/satisfaction-survey-dispatch.scheduler';

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    PatientsModule,
    forwardRef(() => WhatsappModule),
    PrismaBotModule,
    PrismaModule,
    RedisModule,
  ],
  providers: [
    SatisfactionSurveyDispatchWindowService,
    SurveyFlowTemplateConfigService,
    SurveyPhoneVerificationTemplateConfigService,
    SatisfactionSurveyFlowSubmissionFieldMapService,
    SatisfactionSurveyEligibilitySourceConfigService,
    SatisfactionSurveyMetricsAccessConfigService,
    SurveyFlowTokenFactory,
    SatisfactionSurveyPhoneVerificationActionKeyService,
    SurveyWhatsappPhoneNormalizerService,
    SatisfactionSurveyRuntimeSettingsCatalogService,
    SatisfactionSurveyRuntimeSettingsResolverService,
    SatisfactionSurveyRuntimeSettingsInitializerService,
    PrismaLegacySatisfactionSurveyEligibilityRepository,
    JsonFileSatisfactionSurveyEligibilityRepository,
    SatisfactionSurveyDispatchSchedulerConfigService,
    SatisfactionSurveyDispatchScheduler,
    DispatchHalfHourlySatisfactionSurveysUseCase,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    SendSatisfactionSurveyPhoneVerificationUseCase,
    RecordSatisfactionSurveyFlowSubmissionUseCase,
    RecordSatisfactionSurveyTemplateReplyUseCase,
    RegisterWhatsappSurveyConsentUseCase,
    HandleSatisfactionSurveyPhoneVerificationReplyUseCase,
    GetSatisfactionSurveyMetricsUseCase,
    ListSatisfactionSurveyRuntimeSettingEventsUseCase,
    GetSatisfactionSurveyRuntimeSettingsUseCase,
    GetSatisfactionSurveyRuntimeOptionsUseCase,
    UpdateSatisfactionSurveyRuntimeSettingsUseCase,
    ToggleSatisfactionSurveyEmergencyPauseUseCase,
    {
      provide: SURVEY_DISPATCH_REPOSITORY,
      useClass: PrismaBotSurveyDispatchRepository,
    },
    {
      provide: SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
      useClass: PrismaBotSatisfactionSurveyRuntimeSettingsRepository,
    },
    {
      provide: SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
      useFactory: (
        sourceConfig: SatisfactionSurveyEligibilitySourceConfigService,
        legacyRepository: PrismaLegacySatisfactionSurveyEligibilityRepository,
        jsonRepository: JsonFileSatisfactionSurveyEligibilityRepository,
      ) => {
        if (sourceConfig.getSource() === SURVEY_ELIGIBILITY_SOURCES.JSON) {
          return jsonRepository;
        }

        return legacyRepository;
      },
      inject: [
        SatisfactionSurveyEligibilitySourceConfigService,
        PrismaLegacySatisfactionSurveyEligibilityRepository,
        JsonFileSatisfactionSurveyEligibilityRepository,
      ],
    },
    {
      provide: SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
      useClass: PrismaLegacySatisfactionSurveyLegacyStatusRepository,
    },
    {
      provide: SURVEY_RECIPIENT_POLICY_REPOSITORY,
      useClass: PrismaBotSurveyRecipientPolicyRepository,
    },
    {
      provide: SATISFACTION_SURVEY_METRICS_REPOSITORY,
      useClass: PrismaBotSatisfactionSurveyMetricsRepository,
    },
  ],
  controllers: [InternalSatisfactionSurveyMetricsController],
  exports: [
    DispatchHalfHourlySatisfactionSurveysUseCase,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    SendSatisfactionSurveyPhoneVerificationUseCase,
    RecordSatisfactionSurveyFlowSubmissionUseCase,
    RecordSatisfactionSurveyTemplateReplyUseCase,
    RegisterWhatsappSurveyConsentUseCase,
    HandleSatisfactionSurveyPhoneVerificationReplyUseCase,
    GetSatisfactionSurveyMetricsUseCase,
    ListSatisfactionSurveyRuntimeSettingEventsUseCase,
    GetSatisfactionSurveyRuntimeSettingsUseCase,
    GetSatisfactionSurveyRuntimeOptionsUseCase,
    UpdateSatisfactionSurveyRuntimeSettingsUseCase,
    ToggleSatisfactionSurveyEmergencyPauseUseCase,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
  ],
})
export class SurveysModule {}
