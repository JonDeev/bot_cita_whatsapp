import type {
  AdminAuthMeResponseDto,
  AdminLoginRequestDto,
  AdminLoginResponseDto,
} from '@whatsapp-bot/shared';
import { AdminLoginRequestSchema } from '@whatsapp-bot/shared';
import { apiRequest } from '../../shared/http/api-client';
import { getCsrfToken, setCsrfToken } from './session-csrf-store';

interface CsrfResponse {
  csrfToken: string;
}

export async function login(input: AdminLoginRequestDto) {
  const payload = AdminLoginRequestSchema.parse(input);
  return apiRequest<AdminLoginResponseDto>('/api/admin/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function getMe() {
  return apiRequest<AdminAuthMeResponseDto>('/api/admin/auth/me');
}

export async function fetchCsrfToken(): Promise<string> {
  const response = await apiRequest<CsrfResponse>('/api/admin/auth/csrf');
  setCsrfToken(response.csrfToken);
  return response.csrfToken;
}

export async function logout(): Promise<void> {
  const csrf = getCsrfToken() ?? (await fetchCsrfToken());
  await apiRequest('/api/admin/auth/logout', {
    method: 'POST',
    csrfToken: csrf,
  });
  setCsrfToken(null);
}
