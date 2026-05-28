export interface SatisfactionSurveyMetricsWindow {
  windowStartHHmm: string;
  windowEndHHmm: string;
  eligible: number;
  sent: number;
  failed: number;
  completed: number;
  declined: number;
  blocked: number;
  sendRate: number;
  completionRate: number;
}

export interface SatisfactionSurveyMetrics {
  surveyDateIso: string;
  timezone: 'America/Bogota';
  windows: SatisfactionSurveyMetricsWindow[];
  totals: {
    eligible: number;
    sent: number;
    failed: number;
    completed: number;
    declined: number;
    blocked: number;
    sendRate: number;
    completionRate: number;
  };
}

export interface AdminSurveyDispatchItem {
  id: number;
  patientLegacyUserId: number;
  patientPhoneMasked: string;
  surveyDateIso: string;
  status: string;
  triggerType: string;
  windowStartAtIso: string;
  windowEndAtIso: string;
  completedAtIso: string | null;
  failedAtIso: string | null;
  updatedAtIso: string;
}

export interface PaginatedSurveyDispatches {
  items: AdminSurveyDispatchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SurveyMetricsParams {
  date?: string;
  windowStart?: string;
  windowEnd?: string;
}

export interface SurveyDispatchesParams {
  page?: number;
  pageSize?: number;
  status?: string;
  from?: string;
  to?: string;
}
