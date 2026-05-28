import type {
  AdminChatDetailDto,
  AdminChatListItemDto,
  AdminChatMessageItemDto,
  AdminPaginatedResultDto,
} from '@whatsapp-bot/shared';

export type AdminChatListItem = AdminChatListItemDto;
export type AdminChatDetail = AdminChatDetailDto;
export type AdminChatMessageItem = AdminChatMessageItemDto;
export type AdminPaginatedResult<TItem> = AdminPaginatedResultDto<TItem>;

export interface ListChatsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  phone?: string;
  from?: string;
  to?: string;
}

export interface ListChatMessagesParams {
  page?: number;
  pageSize?: number;
}
