import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import type {
  AdminConversationDetail,
  AdminConversationMessageItem,
  AdminConversationListItem,
  ListConversationMessagesParams,
  ListConversationsParams,
  PaginatedResult,
} from './conversations.types';

export function getConversations(params: ListConversationsParams) {
  return apiRequest<PaginatedResult<AdminConversationListItem>>(
    `/api/admin/conversations${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      phone: params.phone,
      from: params.from,
      to: params.to,
    })}`,
  );
}

export function getConversationDetail(conversationId: number) {
  return apiRequest<AdminConversationDetail>(`/api/admin/conversations/${conversationId}`);
}

export function getConversationMessages(
  conversationId: number,
  params: ListConversationMessagesParams,
) {
  return apiRequest<PaginatedResult<AdminConversationMessageItem>>(
    `/api/admin/conversations/${conversationId}/messages${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}
