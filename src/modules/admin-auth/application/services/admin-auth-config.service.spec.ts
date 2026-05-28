import { AdminAuthConfigService } from './admin-auth-config.service';

describe('AdminAuthConfigService', () => {
  const previousEnv = process.env.ADMIN_AUTH_SESSION_COOKIE_NAME;

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.ADMIN_AUTH_SESSION_COOKIE_NAME;
      return;
    }

    process.env.ADMIN_AUTH_SESSION_COOKIE_NAME = previousEnv;
  });

  it('returns default secure host cookie name when env is missing', () => {
    delete process.env.ADMIN_AUTH_SESSION_COOKIE_NAME;
    const service = new AdminAuthConfigService();

    expect(service.getSessionCookieName()).toBe('__Host-sism_admin_session');
  });

  it('rejects cookie names without __Host- prefix', () => {
    process.env.ADMIN_AUTH_SESSION_COOKIE_NAME = 'sism_admin_session';
    const service = new AdminAuthConfigService();

    expect(() => service.getSessionCookieName()).toThrow(
      'Expected "__Host-" prefix.',
    );
  });
});
