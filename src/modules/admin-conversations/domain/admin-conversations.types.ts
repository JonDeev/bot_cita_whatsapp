import type { BotMessageDirection } from '@whatsapp-bot/prisma-client';

export interface AdminConversationListItem {
  id: number;
  conversationKey: string;
  participantPhone: string;
  state: string;
  status: string;
  lastInboundAtIso: string | null;
  updatedAtIso: string;
  lastMessageDirection: BotMessageDirection | null;
  lastMessageType: string | null;
  lastMessageBody: string | null;
  lastMessageOccurredAtIso: string | null;
}

export interface AdminConversationDetail {
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

export interface AdminConversationMessageItem {
  id: number;
  direction: BotMessageDirection;
  whatsappMessageId: string | null;
  messageType: string;
  body: string | null;
  payload: unknown;
  occurredAtIso: string;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}
