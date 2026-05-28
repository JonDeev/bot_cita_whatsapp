import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, getFailureLogs, getOperationalEvents } from './logs.api';
import type {
  ListAuditLogsParams,
  ListFailureLogsParams,
  ListLogsParams,
} from './logs.types';

export const logsQueryKey = ['admin', 'logs'] as const;

interface QueryControlOptions {
  enabled?: boolean;
}

export function useOperationalEventsQuery(
  params: ListLogsParams,
  options: QueryControlOptions = {},
) {
  return useQuery({
    queryKey: [...logsQueryKey, 'events', params],
    queryFn: () => getOperationalEvents(params),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  });
}

export function useFailureLogsQuery(
  params: ListFailureLogsParams,
  options: QueryControlOptions = {},
) {
  return useQuery({
    queryKey: [...logsQueryKey, 'failures', params],
    queryFn: () => getFailureLogs(params),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  });
}

export function useAuditLogsQuery(
  params: ListAuditLogsParams,
  options: QueryControlOptions = {},
) {
  return useQuery({
    queryKey: [...logsQueryKey, 'audit', params],
    queryFn: () => getAuditLogs(params),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  });
}
