import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSurveyRuntimeSettings,
  getSurveyRuntimeSettingsHistory,
  getSurveyRuntimeSettingsOptions,
  toggleSurveyEmergencyPause,
  updateSurveyRuntimeSettings,
} from './survey-settings.api';

export const surveySettingsQueryKey = ['admin', 'survey-settings'] as const;

export function useSurveyRuntimeSettingsQuery() {
  return useQuery({
    queryKey: [...surveySettingsQueryKey, 'settings'],
    queryFn: getSurveyRuntimeSettings,
  });
}

export function useSurveyRuntimeSettingsOptionsQuery() {
  return useQuery({
    queryKey: [...surveySettingsQueryKey, 'options'],
    queryFn: getSurveyRuntimeSettingsOptions,
  });
}

export function useSurveyRuntimeSettingsHistoryQuery(limit = 8) {
  return useQuery({
    queryKey: [...surveySettingsQueryKey, 'history', limit],
    queryFn: () => getSurveyRuntimeSettingsHistory({ limit }),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateSurveyRuntimeSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSurveyRuntimeSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: surveySettingsQueryKey });
    },
  });
}

export function useToggleSurveyEmergencyPauseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleSurveyEmergencyPause,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: surveySettingsQueryKey });
    },
  });
}
