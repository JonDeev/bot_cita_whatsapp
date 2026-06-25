import type {
  AdminChatDetailRecord,
  AdminChatListItemRecord,
  AdminChatMessageRecord,
  PaginatedResult,
} from '../admin-chats.types';

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
  ): Promise<PaginatedResult<AdminChatListItemRecord>>;
  findConversationById(conversationId: number): Promise<AdminChatDetailRecord | null>;
  listConversationMessages(
    query: ListAdminChatMessagesQuery,
  ): Promise<PaginatedResult<AdminChatMessageRecord>>;
}
