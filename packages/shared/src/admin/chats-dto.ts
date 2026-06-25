export interface AdminPaginatedResultDto<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminChatMessageDirectionDto = 'INBOUND' | 'OUTBOUND' | 'SYSTEM';

export interface AdminChatListItemDto {
  id: number;
  participantPhone: string;
  state: string;
  status: string;
  updatedAtIso: string;
  lastMessageDirection: AdminChatMessageDirectionDto | null;
  lastMessageType: string | null;
  lastMessagePreview: string | null;
  lastMessageOccurredAtIso: string | null;
}

export interface AdminChatDetailDto {
  id: number;
  conversationKey: string;
  channel: string;
  participantPhone: string;
  state: string;
  status: string;
  lastInboundAtIso: string | null;
  idleExpiresAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AdminChatMessageItemDto {
  id: number;
  direction: AdminChatMessageDirectionDto;
  whatsappMessageId: string | null;
  messageType: string;
  body: string | null;
  payload: unknown | null;
  occurredAtIso: string;
}

export interface ListAdminChatsQueryDto {
  page?: number;
  pageSize?: number;
  status?: string;
  phone?: string;
  from?: string;
  to?: string;
}

export interface ListAdminChatMessagesQueryDto {
  page?: number;
  pageSize?: number;
}
