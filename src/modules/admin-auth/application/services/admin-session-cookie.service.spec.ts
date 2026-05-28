import type { Response } from 'express';
import { AdminSessionCookieService } from './admin-session-cookie.service';

describe('AdminSessionCookieService', () => {
  const createResponse = (): Pick<Response, 'cookie' | 'clearCookie'> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  it('sets secure httpOnly strict cookie on login', () => {
    const config = {
      getSessionCookieName: () => '__Host-sism_admin_session',
      getCookieSecure: () => true,
    };
    const service = new AdminSessionCookieService(config as never);
    const response = createResponse();
    const expiresAt = new Date('2026-05-28T00:00:00.000Z');

    service.setSessionCookie(response as Response, 'opaque-token', expiresAt);

    expect(response.cookie).toHaveBeenCalledWith(
      '__Host-sism_admin_session',
      'opaque-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        expires: expiresAt,
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      '__Host-sism_admin_session',
      'opaque-token',
      expect.any(Object),
    );
    const calls = (response.cookie as jest.Mock).mock.calls as unknown[];
    const firstCall = calls[0] as [string, string, { domain?: string }];
    expect(firstCall[2].domain).toBeUndefined();
  });

  it('clears cookie with same secure attributes', () => {
    const config = {
      getSessionCookieName: () => '__Host-sism_admin_session',
      getCookieSecure: () => true,
    };
    const service = new AdminSessionCookieService(config as never);
    const response = createResponse();

    service.clearSessionCookie(response as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      '__Host-sism_admin_session',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });
});
