import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { SurveysModule } from '../surveys/surveys.module';
import { RemindersModule } from '../reminders/reminders.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { RedisModule } from '../../shared/infrastructure/redis/redis.module';
import { ProcessWhatsappWebhookUseCase } from './application/use-cases/process-whatsapp-webhook.use-case';
import { VerifyWebhookChallengeUseCase } from './application/use-cases/verify-webhook-challenge.use-case';
import { ConversationOrchestratorService } from './application/services/conversation-orchestrator.service';
import { WhatsappConfigService } from './application/services/whatsapp-config.service';
import {
  WHATSAPP_MESSAGE_SENDER,
  WHATSAPP_PAYLOAD_PARSER,
  WHATSAPP_WEBHOOK_INBOX_REPOSITORY,
  WHATSAPP_SIGNATURE_VERIFIER,
  WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE,
} from './domain/whatsapp.tokens';
import { WebhookIdempotencyKeyFactory } from './application/services/idempotency/webhook-idempotency-key.factory';
import { SendWhatsappInteractiveButtonsMessageUseCase } from './application/use-cases/outbound/send-whatsapp-interactive-buttons-message.use-case';
import { SendWhatsappFlowTemplateMessageUseCase } from './application/use-cases/outbound/send-whatsapp-flow-template-message.use-case';
import { SendWhatsappTemplateMessageUseCase } from './application/use-cases/outbound/send-whatsapp-template-message.use-case';
import { SendWhatsappInteractiveListMessageUseCase } from './application/use-cases/outbound/send-whatsapp-interactive-list-message.use-case';
import { SendWhatsappTextMessageUseCase } from './application/use-cases/outbound/send-whatsapp-text-message.use-case';
import { TemplateMessageSnapshotService } from './application/services/template-message-snapshot.service';
import { MetaWhatsappPayloadParser } from './infrastructure/parsers/meta-whatsapp-payload.parser';
import { MetaSignatureVerifierService } from './infrastructure/security/meta-signature-verifier.service';
import { RedisWebhookIdempotencyStoreAdapter } from './infrastructure/idempotency/redis-webhook-idempotency-store.adapter';
import { PrismaBotWebhookInboxRepository } from './infrastructure/persistence/mysql/prisma-bot-webhook-inbox.repository';
import { MetaWhatsappCloudApiAdapter } from './infrastructure/whatsapp-cloud-api/meta-whatsapp-cloud-api.adapter';
import { ConversationIdlePolicyScheduler } from './infrastructure/scheduling/conversation-idle-policy.scheduler';
import { ConversationIdlePolicySchedulerConfigService } from './infrastructure/scheduling/conversation-idle-policy-scheduler-config.service';
import { WhatsappWebhookController } from './presentation/http/whatsapp-webhook.controller';

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    forwardRef(() => SurveysModule),
    forwardRef(() => RemindersModule),
    PrismaBotModule,
    RedisModule,
  ],
  controllers: [WhatsappWebhookController],
  providers: [
    WhatsappConfigService,
    VerifyWebhookChallengeUseCase,
    ProcessWhatsappWebhookUseCase,
    SendWhatsappFlowTemplateMessageUseCase,
    SendWhatsappTemplateMessageUseCase,
    SendWhatsappInteractiveButtonsMessageUseCase,
    SendWhatsappInteractiveListMessageUseCase,
    SendWhatsappTextMessageUseCase,
    TemplateMessageSnapshotService,
    WebhookIdempotencyKeyFactory,
    ConversationOrchestratorService,
    ConversationIdlePolicySchedulerConfigService,
    ConversationIdlePolicyScheduler,
    {
      provide: WHATSAPP_SIGNATURE_VERIFIER,
      useClass: MetaSignatureVerifierService,
    },
    {
      provide: WHATSAPP_PAYLOAD_PARSER,
      useClass: MetaWhatsappPayloadParser,
    },
    {
      provide: WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE,
      useClass: RedisWebhookIdempotencyStoreAdapter,
    },
    {
      provide: WHATSAPP_WEBHOOK_INBOX_REPOSITORY,
      useClass: PrismaBotWebhookInboxRepository,
    },
    {
      provide: WHATSAPP_MESSAGE_SENDER,
      useClass: MetaWhatsappCloudApiAdapter,
    },
  ],
  exports: [
    SendWhatsappFlowTemplateMessageUseCase,
    SendWhatsappTemplateMessageUseCase,
    TemplateMessageSnapshotService,
    WhatsappConfigService,
  ],
})
export class WhatsappModule {}
