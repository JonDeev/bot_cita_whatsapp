import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import type {
  AppointmentReminderMetrics,
  PaginatedReminderDispatches,
  ReminderDispatchesParams,
} from './reminders.types';

export function getReminderMetrics(lookbackHours?: number) {
  return apiRequest<AppointmentReminderMetrics>(
    `/api/admin/reminders/metrics${buildQueryString({ lookbackHours })}`,
  );
}

export function getReminderDispatches(params: ReminderDispatchesParams) {
  return apiRequest<PaginatedReminderDispatches>(
    `/api/admin/reminders/dispatches${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      from: params.from,
      to: params.to,
    })}`,
  );
}
