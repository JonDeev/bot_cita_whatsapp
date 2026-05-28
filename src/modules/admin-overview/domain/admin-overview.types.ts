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
  | 'system.degraded';

export interface AdminLiveFeedItem {
  eventId: string;
  eventType: AdminLiveFeedEventType;
  occurredAtIso: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  conversationId: number | null;
}
