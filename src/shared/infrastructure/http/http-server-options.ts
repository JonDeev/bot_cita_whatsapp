const DEFAULT_HTTP_HOST = '0.0.0.0';
const DEFAULT_HTTP_PORT = 3000;
const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65_535;

export interface HttpServerOptions {
  host: string;
  port: number;
}

export class InvalidPortEnvironmentVariableError extends Error {
  constructor(portValue: string) {
    super(
      `Invalid PORT value "${portValue}". Set PORT to an integer between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}.`,
    );
    this.name = InvalidPortEnvironmentVariableError.name;
  }
}

interface NodeErrorWithCode extends Error {
  code?: string;
}

export const resolveHttpServerOptions = (
  env: NodeJS.ProcessEnv = process.env,
): HttpServerOptions => {
  const host = env.HOST?.trim() || DEFAULT_HTTP_HOST;
  const port = resolvePort(env.PORT);

  return { host, port };
};

export const formatHttpStartupError = (
  error: unknown,
  options: HttpServerOptions,
): string => {
  if (isNodeErrorWithCode(error, 'EADDRINUSE')) {
    return `Cannot start HTTP server on ${options.host}:${options.port} because the port is already in use. Stop the process using that port or set a different PORT value.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Unknown startup error while binding HTTP server on ${options.host}:${options.port}.`;
};

const resolvePort = (rawPort: string | undefined): number => {
  if (rawPort == null || rawPort.trim() === '') {
    return DEFAULT_HTTP_PORT;
  }

  const parsedPort = Number(rawPort);
  if (
    !Number.isInteger(parsedPort) ||
    parsedPort < MIN_TCP_PORT ||
    parsedPort > MAX_TCP_PORT
  ) {
    throw new InvalidPortEnvironmentVariableError(rawPort);
  }

  return parsedPort;
};

const isNodeErrorWithCode = (
  error: unknown,
  expectedCode: string,
): error is NodeErrorWithCode =>
  error instanceof Error &&
  'code' in error &&
  (error as NodeErrorWithCode).code === expectedCode;
