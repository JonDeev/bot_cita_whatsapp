import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_CONVERSATIONS_REPOSITORY } from '../../domain/admin-conversations.tokens';
import type { AdminConversationsRepository } from '../../domain/ports/admin-conversations.repository';
import { AdminConversationsMaskingService } from '../services/admin-conversations-masking.service';

@Injectable()
export class GetAdminConversationDetailUseCase {
  constructor(
    @Inject(ADMIN_CONVERSATIONS_REPOSITORY)
    private readonly repository: AdminConversationsRepository,
    private readonly masking: AdminConversationsMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number, role: AdminRole, conversationId: number) {
    const conversation =
      await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    await this.audit.write({
      adminUserId,
      action: 'admin.conversation.viewed',
      resourceType: 'conversation',
      resourceId: String(conversationId),
      metadata: {
        viewType: 'detail',
      },
    });

    return this.masking.mapConversationDetail(role, conversation);
  }
}
