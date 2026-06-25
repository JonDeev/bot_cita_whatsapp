import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_CHATS_REPOSITORY } from '../../domain/admin-chats.tokens';
import type {
  AdminChatsRepository,
  ListAdminChatsQuery,
} from '../../domain/ports/admin-chats.repository';
import { AdminChatsMapperService } from '../services/admin-chats-mapper.service';

@Injectable()
export class ListAdminChatsUseCase {
  constructor(
    @Inject(ADMIN_CHATS_REPOSITORY)
    private readonly repository: AdminChatsRepository,
    private readonly mapper: AdminChatsMapperService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number, _role: AdminRole, query: ListAdminChatsQuery) {
    const result = await this.repository.listConversations(query);

    await this.audit.write({
      adminUserId,
      action: 'admin.chat.viewed',
      resourceType: 'chat',
      metadata: {
        viewType: 'list',
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      },
    });

    return this.mapper.mapChatList(result);
  }
}
