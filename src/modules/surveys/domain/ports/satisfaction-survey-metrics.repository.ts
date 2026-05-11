export interface SatisfactionSurveyMetricsWindow {
  windowStartHHmm: string;
  windowEndHHmm: string;
  eligible: number;
  sent: number;
  failed: number;
  completed: number;
  declined: number;
  blocked: number;
}

export interface FindSatisfactionSurveyMetricsFilters {
  surveyDateIso: string;
  windowStartHHmm?: string;
  windowEndHHmm?: string;
}

export interface SatisfactionSurveyMetricsRepository {
  findByDateAndOptionalWindow(
    filters: FindSatisfactionSurveyMetricsFilters,
  ): Promise<SatisfactionSurveyMetricsWindow[]>;
}
