import type {
  AdminConversationDetail,
  AdminConversationListItem,
  AdminConversationMessageItem,
  PaginatedResult,
} from '../admin-conversations.types';

export interface ListAdminConversationsQuery {
  page: number;
  pageSize: number;
  status: string | null;
  participantPhoneContains: string | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface ListAdminConversationMessagesQuery {
  conversationId: number;
  page: number;
  pageSize: number;
}

export interface AdminConversationsRepository {
  listConversations(
    query: ListAdminConversationsQuery,
  ): Promise<PaginatedResult<AdminConversationListItem>>;
  findConversationById(conversationId: number): Promise<AdminConversationDetail | null>;
  listConversationMessages(
    query: ListAdminConversationMessagesQuery,
  ): Promise<PaginatedResult<AdminConversationMessageItem>>;
}
