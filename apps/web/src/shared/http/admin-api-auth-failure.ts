export interface AdminApiAuthFailureEvent {
  status: 401 | 403;
  path: string;
}

const ADMIN_API_AUTH_FAILURE_EVENT_NAME = 'admin-api-auth-failure';

export function emitAdminApiAuthFailure(
  event: AdminApiAuthFailureEvent,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AdminApiAuthFailureEvent>(
      ADMIN_API_AUTH_FAILURE_EVENT_NAME,
      { detail: event },
    ),
  );
}

export function subscribeAdminApiAuthFailure(
  listener: (event: AdminApiAuthFailureEvent) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    listener(event.detail as AdminApiAuthFailureEvent);
  };

  window.addEventListener(ADMIN_API_AUTH_FAILURE_EVENT_NAME, handleEvent);

  return () => {
    window.removeEventListener(ADMIN_API_AUTH_FAILURE_EVENT_NAME, handleEvent);
  };
}

export function shouldEmitAdminApiAuthFailure(
  path: string,
  status: number,
): status is 401 | 403 {
  if (status !== 401 && status !== 403) {
    return false;
  }

  if (!path.startsWith('/api/admin')) {
    return false;
  }

  return path !== '/api/admin/auth/login';
}
