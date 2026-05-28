import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { AdminConversationsMaskingService } from '../../../admin-conversations/application/services/admin-conversations-masking.service';
import { ADMIN_CHATS_REPOSITORY } from '../../domain/admin-chats.tokens';
import type {
  AdminChatsRepository,
  ListAdminChatMessagesQuery,
} from '../../domain/ports/admin-chats.repository';
import { AdminChatsMapperService } from '../services/admin-chats-mapper.service';

@Injectable()
export class ListAdminChatMessagesUseCase {
  constructor(
    @Inject(ADMIN_CHATS_REPOSITORY)
    private readonly repository: AdminChatsRepository,
    private readonly masking: AdminConversationsMaskingService,
    private readonly mapper: AdminChatsMapperService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminChatMessagesQuery,
  ) {
    const result = await this.repository.listConversationMessages(query);

    await this.audit.write({
      adminUserId,
      action: 'admin.chat.messages_viewed',
      resourceType: 'chat',
      resourceId: String(query.conversationId),
      metadata: {
        viewType: 'messages',
        page: query.page,
        pageSize: query.pageSize,
      },
    });

    const masked = this.masking.mapConversationMessages(role, result);
    return this.mapper.mapChatMessages(masked);
  }
}
