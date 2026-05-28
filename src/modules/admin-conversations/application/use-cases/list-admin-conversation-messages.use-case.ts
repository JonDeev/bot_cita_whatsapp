import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_CONVERSATIONS_REPOSITORY } from '../../domain/admin-conversations.tokens';
import type {
  AdminConversationsRepository,
  ListAdminConversationMessagesQuery,
} from '../../domain/ports/admin-conversations.repository';
import { AdminConversationsMaskingService } from '../services/admin-conversations-masking.service';

@Injectable()
export class ListAdminConversationMessagesUseCase {
  constructor(
    @Inject(ADMIN_CONVERSATIONS_REPOSITORY)
    private readonly repository: AdminConversationsRepository,
    private readonly masking: AdminConversationsMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminConversationMessagesQuery,
  ) {
    const result = await this.repository.listConversationMessages(query);
    await this.audit.write({
      adminUserId,
      action: 'admin.conversation.viewed',
      resourceType: 'conversation',
      resourceId: String(query.conversationId),
      metadata: {
        viewType: 'messages',
        page: query.page,
        pageSize: query.pageSize,
      },
    });

    return this.masking.mapConversationMessages(role, result);
  }
}
