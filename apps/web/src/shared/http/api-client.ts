import {
  emitAdminApiAuthFailure,
  shouldEmitAdminApiAuthFailure,
} from './admin-api-auth-failure';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  csrfToken?: string | null;
  signal?: AbortSignal;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = 'Solicitud no completada';

  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (typeof payload.message === 'string') {
      return payload.message;
    }

    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message[0] ?? fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.csrfToken) {
    headers.set('X-CSRF-Token', options.csrfToken);
  }

  const requestInit: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  if (options.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetch(path, requestInit);

  if (!response.ok) {
    if (shouldEmitAdminApiAuthFailure(path, response.status)) {
      emitAdminApiAuthFailure({ status: response.status, path });
    }

    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
