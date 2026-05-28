import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminConversationDetailUseCase } from '../../application/use-cases/get-admin-conversation-detail.use-case';
import { ListAdminConversationMessagesUseCase } from '../../application/use-cases/list-admin-conversation-messages.use-case';
import { ListAdminConversationsUseCase } from '../../application/use-cases/list-admin-conversations.use-case';
import { AdminConversationsQueryParserService } from '../../application/services/admin-conversations-query-parser.service';

const ADMIN_CONVERSATION_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/conversations')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_CONVERSATION_ROLES)
export class AdminConversationsController {
  constructor(
    private readonly parser: AdminConversationsQueryParserService,
    private readonly listConversations: ListAdminConversationsUseCase,
    private readonly getConversationDetail: GetAdminConversationDetailUseCase,
    private readonly listConversationMessages: ListAdminConversationMessagesUseCase,
  ) {}

  @Get()
  async list(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseListConversationsQuery(query);
    return this.listConversations.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }

  @Get(':id')
  async detail(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    return this.getConversationDetail.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      conversationId,
    );
  }

  @Get(':id/messages')
  async listMessages(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseListMessagesQuery(conversationId, query);
    return this.listConversationMessages.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }
}
