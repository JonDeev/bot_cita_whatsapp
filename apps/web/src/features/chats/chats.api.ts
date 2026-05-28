import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import type {
  AdminChatDetail,
  AdminChatListItem,
  AdminChatMessageItem,
  AdminPaginatedResult,
  ListChatMessagesParams,
  ListChatsParams,
} from './chats.types';

export function getChats(params: ListChatsParams) {
  return apiRequest<AdminPaginatedResult<AdminChatListItem>>(
    `/api/admin/chats${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      phone: params.phone,
      from: params.from,
      to: params.to,
    })}`,
  );
}

export function getChatDetail(chatId: number) {
  return apiRequest<AdminChatDetail>(`/api/admin/chats/${chatId}`);
}

export function getChatMessages(chatId: number, params: ListChatMessagesParams) {
  return apiRequest<AdminPaginatedResult<AdminChatMessageItem>>(
    `/api/admin/chats/${chatId}/messages${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}
