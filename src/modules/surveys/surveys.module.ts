import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '../../shared/infrastructure/redis/redis.module';
import { CreateSatisfactionSurveyDispatchUseCase } from './application/use-cases/create-satisfaction-survey-dispatch.use-case';
import { DispatchHalfHourlySatisfactionSurveysUseCase } from './application/use-cases/dispatch-half-hourly-satisfaction-surveys.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './application/use-cases/send-satisfaction-survey-flow-invitation.use-case';
import { RecordSatisfactionSurveyFlowSubmissionUseCase } from './application/use-cases/record-satisfaction-survey-flow-submission.use-case';
import { GetSatisfactionSurveyMetricsUseCase } from './application/use-cases/get-satisfaction-survey-metrics.use-case';
import { SatisfactionSurveyDispatchWindowService } from './application/services/satisfaction-survey-dispatch-window.service';
import { SatisfactionSurveyFlowSubmissionFieldMapService } from './application/services/satisfaction-survey-flow-submission-field-map.service';
import { SatisfactionSurveyMetricsAccessConfigService } from './application/services/satisfaction-survey-metrics-access-config.service';
import { SurveyFlowTemplateConfigService } from './application/services/survey-flow-template-config.service';
import { SurveyFlowTokenFactory } from './application/services/survey-flow-token.factory';
import { SurveyWhatsappPhoneNormalizerService } from './application/services/survey-whatsapp-phone-normalizer.service';
import {
  SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SATISFACTION_SURVEY_METRICS_REPOSITORY,
  SURVEY_DISPATCH_REPOSITORY,
  SURVEY_RECIPIENT_POLICY_REPOSITORY,
} from './domain/surveys.tokens';
import { InternalSatisfactionSurveyMetricsController } from './presentation/http/internal-satisfaction-survey-metrics.controller';
import { PrismaBotSatisfactionSurveyMetricsRepository } from './infrastructure/persistence/mysql/prisma-bot-satisfaction-survey-metrics.repository';
import { PrismaBotSurveyRecipientPolicyRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-recipient-policy.repository';
import { PrismaLegacySatisfactionSurveyEligibilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-eligibility.repository';
import { PrismaLegacySatisfactionSurveyLegacyStatusRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-legacy-status.repository';
import { PrismaBotSurveyDispatchRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-dispatch.repository';
import { SatisfactionSurveyDispatchSchedulerConfigService } from './infrastructure/scheduling/satisfaction-survey-dispatch-scheduler-config.service';
import { SatisfactionSurveyDispatchScheduler } from './infrastructure/scheduling/satisfaction-survey-dispatch.scheduler';

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    forwardRef(() => WhatsappModule),
    PrismaBotModule,
    PrismaModule,
    RedisModule,
  ],
  providers: [
    SatisfactionSurveyDispatchWindowService,
    SurveyFlowTemplateConfigService,
    SatisfactionSurveyFlowSubmissionFieldMapService,
    SatisfactionSurveyMetricsAccessConfigService,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
    SatisfactionSurveyDispatchSchedulerConfigService,
    SatisfactionSurveyDispatchScheduler,
    DispatchHalfHourlySatisfactionSurveysUseCase,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    RecordSatisfactionSurveyFlowSubmissionUseCase,
    GetSatisfactionSurveyMetricsUseCase,
    {
      provide: SURVEY_DISPATCH_REPOSITORY,
      useClass: PrismaBotSurveyDispatchRepository,
    },
    {
      provide: SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
      useClass: PrismaLegacySatisfactionSurveyEligibilityRepository,
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
    RecordSatisfactionSurveyFlowSubmissionUseCase,
    GetSatisfactionSurveyMetricsUseCase,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
  ],
})
export class SurveysModule {}
