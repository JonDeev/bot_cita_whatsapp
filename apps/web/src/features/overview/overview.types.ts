export interface AdminDispatchStatusCount {
  status: string;
  count: number;
}

export interface AdminOverviewSnapshot {
  generatedAtIso: string;
  lookbackHours: number;
  inboundMessages: number;
  outboundMessages: number;
  outboxFailed: number;
  webhookFailed: number;
  activeConversations: number;
  reminderDispatches: AdminDispatchStatusCount[];
  surveyDispatches: AdminDispatchStatusCount[];
}

export type AdminLiveFeedEventType =
  | 'message.inbound'
  | 'message.outbound'
  | 'outbox.failed'
  | 'webhook.failed'
  | 'reminder.failed'
  | 'survey.completed'
  | 'system.degraded'
  | 'auth.session.revoked'
  | 'heartbeat';

export interface AdminLiveFeedItem {
  eventId: string;
  eventType: Exclude<AdminLiveFeedEventType, 'auth.session.revoked' | 'heartbeat'>;
  occurredAtIso: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  conversationId: number | null;
}

export interface AdminLiveFeedResponse {
  generatedAtIso: string;
  lookbackHours: number;
  limit: number;
  items: AdminLiveFeedItem[];
}

export interface AdminStreamEvent {
  eventType: AdminLiveFeedEventType;
  occurredAtIso: string;
  summary?: string;
  severity?: 'info' | 'warning' | 'error';
  conversationId?: number | null;
  [key: string]: unknown;
}
