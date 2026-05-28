import { useMutation, useQuery } from '@tanstack/react-query';
import type { AdminLoginRequestDto } from '@whatsapp-bot/shared';
import { fetchCsrfToken, getMe, login, logout } from './auth.api';

export const meQueryKey = ['admin-auth', 'me'] as const;

export function useAdminMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    retry: false,
  });
}

export function useLoginAdmin() {
  return useMutation({
    mutationFn: async (input: AdminLoginRequestDto) => {
      const response = await login(input);
      await fetchCsrfToken();
      return response;
    },
  });
}

export function useLogoutAdmin() {
  return useMutation({
    mutationFn: logout,
  });
}
