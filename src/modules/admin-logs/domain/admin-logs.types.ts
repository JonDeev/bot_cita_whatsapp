export interface PaginatedAdminLogsResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminFailureSource = 'OUTBOX' | 'WEBHOOK';

export interface AdminOperationalEventItem {
  id: number;
  action: string;
  conversationId: number | null;
  conversationKey: string | null;
  occurredAtIso: string;
  metadata: unknown;
}

export interface AdminFailureLogItem {
  source: AdminFailureSource;
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
