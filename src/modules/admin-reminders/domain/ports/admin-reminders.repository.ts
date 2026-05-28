import type { AdminReminderDispatchListResult } from '../admin-reminders.types';

export interface ListAdminReminderDispatchesQuery {
  page: number;
  pageSize: number;
  status: string | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface AdminRemindersRepository {
  listDispatches(
    query: ListAdminReminderDispatchesQuery,
  ): Promise<AdminReminderDispatchListResult>;
}
