import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../../shared/http/api-client';
import { useAdminMe } from './auth.hooks';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const meQuery = useAdminMe();

  if (meQuery.isPending) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm text-[var(--muted)]">Cargando sesion...</p>
      </main>
    );
  }

  if (meQuery.isError) {
    const isForbidden =
      meQuery.error instanceof ApiError && meQuery.error.status === 403;

    return (
      <Navigate
        to={isForbidden ? '/admin/unauthorized' : '/admin/login'}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
