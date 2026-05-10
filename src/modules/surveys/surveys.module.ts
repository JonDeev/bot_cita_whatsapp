import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { CreateSatisfactionSurveyDispatchUseCase } from './application/use-cases/create-satisfaction-survey-dispatch.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './application/use-cases/send-satisfaction-survey-flow-invitation.use-case';
import { SurveyFlowTemplateConfigService } from './application/services/survey-flow-template-config.service';
import { SurveyFlowTokenFactory } from './application/services/survey-flow-token.factory';
import { SurveyWhatsappPhoneNormalizerService } from './application/services/survey-whatsapp-phone-normalizer.service';
import { SURVEY_DISPATCH_REPOSITORY } from './domain/surveys.tokens';
import { PrismaBotSurveyDispatchRepository } from './infrastructure/persistence/mysql/prisma-bot-survey-dispatch.repository';

@Module({
  imports: [AuditModule, ConversationsModule, WhatsappModule, PrismaBotModule],
  providers: [
    SurveyFlowTemplateConfigService,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    {
      provide: SURVEY_DISPATCH_REPOSITORY,
      useClass: PrismaBotSurveyDispatchRepository,
    },
  ],
  exports: [
    CreateSatisfactionSurveyDispatchUseCase,
    SendSatisfactionSurveyFlowInvitationUseCase,
    SurveyFlowTokenFactory,
    SurveyWhatsappPhoneNormalizerService,
  ],
})
export class SurveysModule {}
