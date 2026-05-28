import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminChatDetailDto,
  AdminChatListItemDto,
  AdminChatMessageItemDto,
  AdminPaginatedResultDto,
  AdminRole,
} from '@whatsapp-bot/shared';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminChatDetailUseCase } from '../../application/use-cases/get-admin-chat-detail.use-case';
import { ListAdminChatMessagesUseCase } from '../../application/use-cases/list-admin-chat-messages.use-case';
import { ListAdminChatsUseCase } from '../../application/use-cases/list-admin-chats.use-case';
import { AdminChatsQueryParserService } from '../../application/services/admin-chats-query-parser.service';

const ADMIN_CHAT_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/chats')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_CHAT_ROLES)
export class AdminChatsController {
  constructor(
    private readonly parser: AdminChatsQueryParserService,
    private readonly listChats: ListAdminChatsUseCase,
    private readonly getChatDetail: GetAdminChatDetailUseCase,
    private readonly listChatMessages: ListAdminChatMessagesUseCase,
  ) {}

  @Get()
  list(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ): Promise<AdminPaginatedResultDto<AdminChatListItemDto>> {
    const parsed = this.parser.parseListChatsQuery(query);
    return this.listChats.execute(adminAuth!.user.id, adminAuth!.user.role, parsed);
  }

  @Get(':id')
  detail(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Param('id', ParseIntPipe) conversationId: number,
  ): Promise<AdminChatDetailDto> {
    return this.getChatDetail.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      conversationId,
    );
  }

  @Get(':id/messages')
  listMessages(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: unknown,
  ): Promise<AdminPaginatedResultDto<AdminChatMessageItemDto>> {
    const parsed = this.parser.parseListMessagesQuery(conversationId, query);
    return this.listChatMessages.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }
}
