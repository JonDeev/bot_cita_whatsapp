import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_CONVERSATIONS_REPOSITORY } from '../../domain/admin-conversations.tokens';
import type { AdminConversationsRepository } from '../../domain/ports/admin-conversations.repository';
import { AdminConversationsMaskingService } from '../services/admin-conversations-masking.service';
import type { ListAdminConversationsQuery } from '../../domain/ports/admin-conversations.repository';

@Injectable()
export class ListAdminConversationsUseCase {
  constructor(
    @Inject(ADMIN_CONVERSATIONS_REPOSITORY)
    private readonly repository: AdminConversationsRepository,
    private readonly masking: AdminConversationsMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminConversationsQuery,
  ) {
    const result = await this.repository.listConversations(query);
    await this.audit.write({
      adminUserId,
      action: 'admin.conversation.viewed',
      resourceType: 'conversation',
      metadata: {
        viewType: 'list',
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      },
    });

    return this.masking.mapConversationList(role, result);
  }
}
