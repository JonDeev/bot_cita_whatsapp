import { useMemo } from 'react';
import { useAdminMe } from './auth.hooks';

export function useAdminAccess() {
  const meQuery = useAdminMe();

  return useMemo(() => {
    const role = meQuery.data?.role;

    return {
      role,
      isAdmin: role === 'ADMIN',
      isSupervisor: role === 'SUPERVISOR',
      canViewTechnicalDetails: role === 'ADMIN',
    };
  }, [meQuery.data?.role]);
}
