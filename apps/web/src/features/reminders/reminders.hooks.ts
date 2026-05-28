import { useQuery } from '@tanstack/react-query';
import { getReminderDispatches, getReminderMetrics } from './reminders.api';
import type { ReminderDispatchesParams } from './reminders.types';

export const remindersQueryKey = ['admin', 'reminders'] as const;

export function useReminderMetricsQuery(lookbackHours?: number) {
  return useQuery({
    queryKey: [...remindersQueryKey, 'metrics', lookbackHours],
    queryFn: () => getReminderMetrics(lookbackHours),
  });
}

export function useReminderDispatchesQuery(params: ReminderDispatchesParams) {
  return useQuery({
    queryKey: [...remindersQueryKey, 'dispatches', params],
    queryFn: () => getReminderDispatches(params),
    placeholderData: (previous) => previous,
  });
}
