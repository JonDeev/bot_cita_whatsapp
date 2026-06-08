import { apiRequest } from '../../shared/http/api-client';
import { buildQueryString } from '../../shared/http/query-string';
import { fetchCsrfToken } from '../auth/auth.api';
import { getCsrfToken } from '../auth/session-csrf-store';
import {
  ReminderEmergencyPauseUpdateRequestSchema,
  ReminderRuntimeSettingsUpdateRequestSchema,
} from '@whatsapp-bot/shared';
import type {
  ReminderEmergencyPauseUpdateRequest,
  ReminderRuntimeSettingHistoryResult,
  ReminderRuntimeSettings,
  ReminderRuntimeSettingsOptions,
  ReminderRuntimeSettingsUpdateRequest,
} from './reminder-settings.types';

async function ensureCsrfToken(): Promise<string> {
  return getCsrfToken() ?? fetchCsrfToken();
}

export function getReminderRuntimeSettings() {
  return apiRequest<ReminderRuntimeSettings>('/api/admin/reminders/settings');
}

export function getReminderRuntimeSettingsOptions() {
  return apiRequest<ReminderRuntimeSettingsOptions>(
    '/api/admin/reminders/settings/options',
  );
}

export function getReminderRuntimeSettingsHistory(params: {
  page?: number;
  pageSize?: number;
}) {
  return apiRequest<ReminderRuntimeSettingHistoryResult>(
    `/api/admin/reminders/settings/history${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}

export async function updateReminderRuntimeSettings(
  input: ReminderRuntimeSettingsUpdateRequest,
) {
  const payload = ReminderRuntimeSettingsUpdateRequestSchema.parse(input);
  const csrfToken = await ensureCsrfToken();

  return apiRequest<ReminderRuntimeSettings>('/api/admin/reminders/settings', {
    method: 'PATCH',
    body: payload,
    csrfToken,
  });
}

export async function toggleReminderEmergencyPause(
  input: ReminderEmergencyPauseUpdateRequest,
) {
  const payload = ReminderEmergencyPauseUpdateRequestSchema.parse(input);
  const csrfToken = await ensureCsrfToken();

  return apiRequest<ReminderRuntimeSettings>(
    '/api/admin/reminders/settings/emergency-pause',
    {
      method: 'POST',
      body: {
        expectedVersion: payload.expectedVersion,
        reason: payload.reason,
        enabled: payload.emergencyPauseEnabled === 'enabled',
      },
      csrfToken,
    },
  );
}
