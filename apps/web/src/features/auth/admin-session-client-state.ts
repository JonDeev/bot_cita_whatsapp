import type { QueryClient } from '@tanstack/react-query';
import { setCsrfToken } from './session-csrf-store';

export function clearAdminClientState(queryClient: QueryClient): void {
  queryClient.clear();
  setCsrfToken(null);
}
