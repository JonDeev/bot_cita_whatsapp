export interface AdminSurveyDispatchItem {
  id: number;
  patientLegacyUserId: number;
  patientPhone: string;
  surveyDateIso: string;
  status: string;
  triggerType: string;
  windowStartAtIso: string;
  windowEndAtIso: string;
  completedAtIso: string | null;
  failedAtIso: string | null;
  updatedAtIso: string;
}

export interface AdminSurveyDispatchListResult {
  items: AdminSurveyDispatchItem[];
  total: number;
  page: number;
  pageSize: number;
}
