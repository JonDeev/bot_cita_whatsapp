import {
  InvalidPortEnvironmentVariableError,
  formatHttpStartupError,
  resolveHttpServerOptions,
} from './http-server-options';

describe('http-server-options', () => {
  describe('resolveHttpServerOptions', () => {
    it('uses defaults when HOST and PORT are not set', () => {
      const options = resolveHttpServerOptions({});

      expect(options).toEqual({
        host: '0.0.0.0',
        port: 3000,
      });
    });

    it('uses configured HOST and PORT when provided', () => {
      const options = resolveHttpServerOptions({
        HOST: '127.0.0.1',
        PORT: '3100',
      });

      expect(options).toEqual({
        host: '127.0.0.1',
        port: 3100,
      });
    });

    it('trims HOST and falls back to default when HOST is blank', () => {
      const options = resolveHttpServerOptions({
        HOST: '   ',
        PORT: '3001',
      });

      expect(options).toEqual({
        host: '0.0.0.0',
        port: 3001,
      });
    });

    it('throws when PORT is invalid', () => {
      expect(() =>
        resolveHttpServerOptions({
          PORT: 'not-a-number',
        }),
      ).toThrow(InvalidPortEnvironmentVariableError);
    });
  });

  describe('formatHttpStartupError', () => {
    it('returns a clear message for EADDRINUSE', () => {
      const error = Object.assign(new Error('listen EADDRINUSE'), {
        code: 'EADDRINUSE',
      });

      const message = formatHttpStartupError(error, {
        host: '0.0.0.0',
        port: 3000,
      });

      expect(message).toContain('already in use');
      expect(message).toContain('3000');
    });
  });
});
