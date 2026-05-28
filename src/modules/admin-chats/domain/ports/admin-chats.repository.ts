import type {
  AdminConversationDetail,
  AdminConversationListItem,
  AdminConversationMessageItem,
  PaginatedResult,
} from '../../../admin-conversations/domain/admin-conversations.types';

export interface ListAdminChatsQuery {
  page: number;
  pageSize: number;
  status: string | null;
  participantPhoneContains: string | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface ListAdminChatMessagesQuery {
  conversationId: number;
  page: number;
  pageSize: number;
}

export interface AdminChatsRepository {
  listConversations(
    query: ListAdminChatsQuery,
  ): Promise<PaginatedResult<AdminConversationListItem>>;
  findConversationById(conversationId: number): Promise<AdminConversationDetail | null>;
  listConversationMessages(
    query: ListAdminChatMessagesQuery,
  ): Promise<PaginatedResult<AdminConversationMessageItem>>;
}
