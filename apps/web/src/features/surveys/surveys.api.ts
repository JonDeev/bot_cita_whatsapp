import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import type {
  PaginatedSurveyDispatches,
  SatisfactionSurveyMetrics,
  SurveyDispatchesParams,
  SurveyMetricsParams,
} from './surveys.types';

export function getSurveyMetrics(params: SurveyMetricsParams) {
  return apiRequest<SatisfactionSurveyMetrics>(
    `/api/admin/surveys/metrics${buildQueryString({
      date: params.date,
      windowStart: params.windowStart,
      windowEnd: params.windowEnd,
    })}`,
  );
}

export function getSurveyDispatches(params: SurveyDispatchesParams) {
  return apiRequest<PaginatedSurveyDispatches>(
    `/api/admin/surveys/dispatches${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      from: params.from,
      to: params.to,
    })}`,
  );
}
