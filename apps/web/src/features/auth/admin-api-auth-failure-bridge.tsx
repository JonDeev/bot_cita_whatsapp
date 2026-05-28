import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  subscribeAdminApiAuthFailure,
  type AdminApiAuthFailureEvent,
} from '../../shared/http/admin-api-auth-failure';
import { clearAdminClientState } from './admin-session-client-state';

const AUTH_FAILURE_THROTTLE_MS = 750;

export function AdminApiAuthFailureBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const lastHandledAtRef = useRef<number>(0);

  useEffect(() => {
    const handleFailure = (event: AdminApiAuthFailureEvent) => {
      const now = Date.now();
      if (now - lastHandledAtRef.current < AUTH_FAILURE_THROTTLE_MS) {
        return;
      }
      lastHandledAtRef.current = now;

      clearAdminClientState(queryClient);

      if (event.status === 403) {
        if (location.pathname !== '/admin/unauthorized') {
          toast.error('No tienes permisos para este recurso.');
          navigate('/admin/unauthorized', { replace: true });
        }
        return;
      }

      if (location.pathname !== '/admin/login') {
        toast.error('Tu sesion expiro. Inicia sesion nuevamente.');
        navigate('/admin/login', { replace: true });
      }
    };

    return subscribeAdminApiAuthFailure(handleFailure);
  }, [location.pathname, navigate, queryClient]);

  return null;
}
