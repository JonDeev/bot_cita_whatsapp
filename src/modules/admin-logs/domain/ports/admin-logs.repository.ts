import type {
  AdminAuditLogItem,
  AdminFailureLogItem,
  AdminFailureSource,
  AdminOperationalEventItem,
  PaginatedAdminLogsResult,
} from '../admin-logs.types';

export interface AdminLogsPaginationQuery {
  page: number;
  pageSize: number;
}

export interface ListAdminEventsQuery extends AdminLogsPaginationQuery {
  action: string | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface ListAdminFailuresQuery extends AdminLogsPaginationQuery {
  source: AdminFailureSource | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface ListAdminAuditQuery extends AdminLogsPaginationQuery {
  action: string | null;
  adminUserId: number | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface AdminLogsRepository {
  listEvents(
    query: ListAdminEventsQuery,
  ): Promise<PaginatedAdminLogsResult<AdminOperationalEventItem>>;
  listFailures(
    query: ListAdminFailuresQuery,
  ): Promise<PaginatedAdminLogsResult<AdminFailureLogItem>>;
  listAudit(
    query: ListAdminAuditQuery,
  ): Promise<PaginatedAdminLogsResult<AdminAuditLogItem>>;
}
