import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReminderRuntimeSettings,
  getReminderRuntimeSettingsHistory,
  getReminderRuntimeSettingsOptions,
  toggleReminderEmergencyPause,
  updateReminderRuntimeSettings,
} from './reminder-settings.api';

export const reminderSettingsQueryKey = ['admin', 'reminder-settings'] as const;

export function useReminderRuntimeSettingsQuery() {
  return useQuery({
    queryKey: [...reminderSettingsQueryKey, 'settings'],
    queryFn: getReminderRuntimeSettings,
  });
}

export function useReminderRuntimeSettingsOptionsQuery() {
  return useQuery({
    queryKey: [...reminderSettingsQueryKey, 'options'],
    queryFn: getReminderRuntimeSettingsOptions,
  });
}

export function useReminderRuntimeSettingsHistoryQuery(pageSize = 8) {
  return useQuery({
    queryKey: [...reminderSettingsQueryKey, 'history', pageSize],
    queryFn: () => getReminderRuntimeSettingsHistory({ page: 1, pageSize }),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateReminderRuntimeSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateReminderRuntimeSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderSettingsQueryKey });
    },
  });
}

export function useToggleReminderEmergencyPauseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleReminderEmergencyPause,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderSettingsQueryKey });
    },
  });
}
