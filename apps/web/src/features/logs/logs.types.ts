export interface PaginatedResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOperationalEventItem {
  id: number;
  action: string;
  conversationId: number | null;
  conversationKey: string | null;
  occurredAtIso: string;
  metadata: unknown;
}

export interface AdminFailureLogItem {
  source: 'OUTBOX' | 'WEBHOOK';
  id: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  occurredAtIso: string;
  conversationId: number | null;
}

export interface AdminAuditLogItem {
  id: number;
  adminUserId: number | null;
  adminUsername: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  occurredAtIso: string;
  metadata: unknown;
}

export interface ListLogsParams {
  page?: number;
  pageSize?: number;
  action?: string;
  from?: string;
  to?: string;
}

export interface ListFailureLogsParams {
  page?: number;
  pageSize?: number;
  source?: 'OUTBOX' | 'WEBHOOK';
  from?: string;
  to?: string;
}

export interface ListAuditLogsParams {
  page?: number;
  pageSize?: number;
  action?: string;
  adminUserId?: number;
  from?: string;
  to?: string;
}
