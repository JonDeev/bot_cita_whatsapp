import type { AdminSurveyDispatchListResult } from '../admin-surveys.types';

export interface ListAdminSurveyDispatchesQuery {
  page: number;
  pageSize: number;
  status: string | null;
  fromIso: string | null;
  toIso: string | null;
}

export interface AdminSurveysRepository {
  listDispatches(
    query: ListAdminSurveyDispatchesQuery,
  ): Promise<AdminSurveyDispatchListResult>;
}
