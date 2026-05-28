import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminConversationsModule } from '../admin-conversations/admin-conversations.module';
import { AdminConversationsMaskingService } from '../admin-conversations/application/services/admin-conversations-masking.service';
import { ADMIN_CONVERSATIONS_REPOSITORY } from '../admin-conversations/domain/admin-conversations.tokens';
import { AdminChatsMapperService } from './application/services/admin-chats-mapper.service';
import { AdminChatsQueryParserService } from './application/services/admin-chats-query-parser.service';
import { GetAdminChatDetailUseCase } from './application/use-cases/get-admin-chat-detail.use-case';
import { ListAdminChatMessagesUseCase } from './application/use-cases/list-admin-chat-messages.use-case';
import { ListAdminChatsUseCase } from './application/use-cases/list-admin-chats.use-case';
import { ADMIN_CHATS_REPOSITORY } from './domain/admin-chats.tokens';
import { AdminChatsController } from './presentation/http/admin-chats.controller';

@Module({
  imports: [AdminAuthModule, AdminConversationsModule],
  controllers: [AdminChatsController],
  providers: [
    AdminChatsQueryParserService,
    AdminChatsMapperService,
    ListAdminChatsUseCase,
    GetAdminChatDetailUseCase,
    ListAdminChatMessagesUseCase,
    AdminConversationsMaskingService,
    {
      provide: ADMIN_CHATS_REPOSITORY,
      useExisting: ADMIN_CONVERSATIONS_REPOSITORY,
    },
  ],
})
export class AdminChatsModule {}
