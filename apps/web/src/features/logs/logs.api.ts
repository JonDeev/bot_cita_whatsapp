import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import type {
  AdminAuditLogItem,
  AdminFailureLogItem,
  AdminOperationalEventItem,
  ListAuditLogsParams,
  ListFailureLogsParams,
  ListLogsParams,
  PaginatedResult,
} from './logs.types';

export function getOperationalEvents(params: ListLogsParams) {
  return apiRequest<PaginatedResult<AdminOperationalEventItem>>(
    `/api/admin/logs/events${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      action: params.action,
      from: params.from,
      to: params.to,
    })}`,
  );
}

export function getFailureLogs(params: ListFailureLogsParams) {
  return apiRequest<PaginatedResult<AdminFailureLogItem>>(
    `/api/admin/logs/failures${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      source: params.source,
      from: params.from,
      to: params.to,
    })}`,
  );
}

export function getAuditLogs(params: ListAuditLogsParams) {
  return apiRequest<PaginatedResult<AdminAuditLogItem>>(
    `/api/admin/logs/audit${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      action: params.action,
      adminUserId: params.adminUserId,
      from: params.from,
      to: params.to,
    })}`,
  );
}
