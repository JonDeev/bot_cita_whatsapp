import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CreateSatisfactionSurveyDispatchUseCase } from './application/use-cases/create-satisfaction-survey-dispatch.use-case';
import { DispatchHalfHourlySatisfactionSurveysUseCase } from './application/use-cases/dispatch-half-hourly-satisfaction-surveys.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './application/use-cases/send-satisfaction-survey-flow-invitation.use-case';
import { SatisfactionSurveyDispatchWindowService } from './application/services/satisfaction-survey-dispatch-window.service';
import { SurveyFlowTemplateConfigService } from './application/services/survey-flow-template-config.service';
import { SurveyFlowTokenFactory } from './application/services/survey-flow-token.factory';
import { SurveyWhatsappPhoneNormalizerService } from './application/services/survey-whatsapp-phone-normalizer.service';
import {
  SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SURVEY_DISPATCH_REPOSITORY,
  SURVEY_RECIPIENT_POLICY_REPOSITORY,
} from './domain/surveys.tokens';
import { PrismaBotSurveyRecipientPolicyRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-recipient-policy.repository';
import { PrismaLegacySatisfactionSurveyEligibilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-eligibility.repository';
import { PrismaLegacySatisfactionSurveyLegacyStatusRepository } from './infrastructure/persistence/mysql/prisma-legacy-satisfaction-survey-legacy-status.repository';
import { PrismaBotSurveyDispatchRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-dispatch.repository';

@Module({
  imports: [AuditModule, ConversationsModule, WhatsappModule, PrismaBotModule, PrismaModule],
  providers: [
    SatisfactionSurveyDispatchWindowService,
    SurveyFlowTemplateConfigService,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
    DispatchHalfHourlySatisfactionSurveysUseCase,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
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
  ],
  exports: [
    DispatchHalfHourlySatisfactionSurveysUseCase,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
  ],
})
export class SurveysModule {}
