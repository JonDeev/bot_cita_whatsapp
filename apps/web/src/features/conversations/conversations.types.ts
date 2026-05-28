export interface PaginatedResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminConversationListItem {
  id: number;
  conversationKey: string;
  state: string;
  status: string;
  lastInboundAtIso: string | null;
  updatedAtIso: string;
  lastMessageDirection: 'INBOUND' | 'OUTBOUND' | null;
  lastMessageType: string | null;
  lastMessageBody: string | null;
  lastMessageOccurredAtIso: string | null;
  participantPhoneMasked: string;
}

export interface AdminConversationDetail {
  id: number;
  conversationKey: string;
  channel: string;
  state: string;
  status: string;
  lastInboundAtIso: string | null;
  idleExpiresAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  participantPhoneMasked: string;
}

export interface AdminConversationMessageItem {
  id: number;
  direction: 'INBOUND' | 'OUTBOUND';
  whatsappMessageId: string | null;
  messageType: string;
  body: string | null;
  payload: unknown | null;
  occurredAtIso: string;
}

export interface ListConversationsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  phone?: string;
  from?: string;
  to?: string;
}

export interface ListConversationMessagesParams {
  page?: number;
  pageSize?: number;
}
