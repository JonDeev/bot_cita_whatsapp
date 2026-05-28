import { useQuery } from '@tanstack/react-query';
import { getSurveyDispatches, getSurveyMetrics } from './surveys.api';
import type { SurveyDispatchesParams, SurveyMetricsParams } from './surveys.types';

export const surveysQueryKey = ['admin', 'surveys'] as const;

export function useSurveyMetricsQuery(params: SurveyMetricsParams) {
  return useQuery({
    queryKey: [...surveysQueryKey, 'metrics', params],
    queryFn: () => getSurveyMetrics(params),
  });
}

export function useSurveyDispatchesQuery(params: SurveyDispatchesParams) {
  return useQuery({
    queryKey: [...surveysQueryKey, 'dispatches', params],
    queryFn: () => getSurveyDispatches(params),
    placeholderData: (previous) => previous,
  });
}
