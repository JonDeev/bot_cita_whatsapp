import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { AdminConversationsMaskingService } from '../../../admin-conversations/application/services/admin-conversations-masking.service';
import { ADMIN_CHATS_REPOSITORY } from '../../domain/admin-chats.tokens';
import type { AdminChatsRepository } from '../../domain/ports/admin-chats.repository';
import { AdminChatsMapperService } from '../services/admin-chats-mapper.service';

@Injectable()
export class GetAdminChatDetailUseCase {
  constructor(
    @Inject(ADMIN_CHATS_REPOSITORY)
    private readonly repository: AdminChatsRepository,
    private readonly masking: AdminConversationsMaskingService,
    private readonly mapper: AdminChatsMapperService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number, role: AdminRole, conversationId: number) {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Chat not found.');
    }

    await this.audit.write({
      adminUserId,
      action: 'admin.chat.viewed',
      resourceType: 'chat',
      resourceId: String(conversationId),
      metadata: {
        viewType: 'detail',
      },
    });

    const masked = this.masking.mapConversationDetail(role, conversation);
    return this.mapper.mapChatDetail(masked);
  }
}
