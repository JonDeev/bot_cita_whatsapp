import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ADMIN_CONVERSATIONS_REPOSITORY } from './domain/admin-conversations.tokens';
import { AdminConversationsQueryParserService } from './application/services/admin-conversations-query-parser.service';
import { AdminConversationsMaskingService } from './application/services/admin-conversations-masking.service';
import { ListAdminConversationsUseCase } from './application/use-cases/list-admin-conversations.use-case';
import { GetAdminConversationDetailUseCase } from './application/use-cases/get-admin-conversation-detail.use-case';
import { ListAdminConversationMessagesUseCase } from './application/use-cases/list-admin-conversation-messages.use-case';
import { PrismaBotAdminConversationsRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-conversations.repository';
import { AdminConversationsController } from './presentation/http/admin-conversations.controller';

@Module({
  imports: [PrismaBotModule, AdminAuthModule],
  controllers: [AdminConversationsController],
  providers: [
    AdminConversationsQueryParserService,
    AdminConversationsMaskingService,
    ListAdminConversationsUseCase,
    GetAdminConversationDetailUseCase,
    ListAdminConversationMessagesUseCase,
    {
      provide: ADMIN_CONVERSATIONS_REPOSITORY,
      useClass: PrismaBotAdminConversationsRepository,
    },
  ],
  exports: [ADMIN_CONVERSATIONS_REPOSITORY],
})
export class AdminConversationsModule {}
