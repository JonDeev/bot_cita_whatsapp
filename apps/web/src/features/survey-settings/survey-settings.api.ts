import {
  SurveyEmergencyPauseUpdateRequestSchema,
  SurveyRuntimeSettingsUpdateRequestSchema,
} from '@whatsapp-bot/shared';
import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import { fetchCsrfToken } from '../auth/auth.api';
import { getCsrfToken } from '../auth/session-csrf-store';
import type {
  SurveyEmergencyPauseUpdateRequest,
  SurveyRuntimeSettingHistoryResult,
  SurveyRuntimeSettings,
  SurveyRuntimeSettingsOptions,
  SurveyRuntimeSettingsUpdateRequest,
} from './survey-settings.types';

async function ensureCsrfToken(): Promise<string> {
  return getCsrfToken() ?? fetchCsrfToken();
}

export function getSurveyRuntimeSettings() {
  return apiRequest<SurveyRuntimeSettings>('/api/admin/surveys/settings');
}

export function getSurveyRuntimeSettingsOptions() {
  return apiRequest<SurveyRuntimeSettingsOptions>(
    '/api/admin/surveys/settings/options',
  );
}

export function getSurveyRuntimeSettingsHistory(params: {
  limit?: number;
}) {
  return apiRequest<SurveyRuntimeSettingHistoryResult>(
    `/api/admin/surveys/settings/history${buildQueryString({
      limit: params.limit,
    })}`,
  );
}

export async function updateSurveyRuntimeSettings(
  input: SurveyRuntimeSettingsUpdateRequest,
) {
  const payload = SurveyRuntimeSettingsUpdateRequestSchema.parse(input);
  const csrfToken = await ensureCsrfToken();

  return apiRequest<SurveyRuntimeSettings>('/api/admin/surveys/settings', {
    method: 'PATCH',
    body: payload,
    csrfToken,
  });
}

export async function toggleSurveyEmergencyPause(
  input: SurveyEmergencyPauseUpdateRequest,
) {
  const payload = SurveyEmergencyPauseUpdateRequestSchema.parse(input);
  const csrfToken = await ensureCsrfToken();

  return apiRequest<SurveyRuntimeSettings>(
    '/api/admin/surveys/settings/emergency-pause',
    {
      method: 'POST',
      body: payload,
      csrfToken,
    },
  );
}
