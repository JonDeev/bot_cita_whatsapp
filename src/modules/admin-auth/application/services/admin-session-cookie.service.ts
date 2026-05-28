import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthConfigService } from './admin-auth-config.service';

@Injectable()
export class AdminSessionCookieService {
  constructor(private readonly config: AdminAuthConfigService) {}

  setSessionCookie(
    response: Response,
    sessionToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(this.config.getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: this.config.getCookieSecure(),
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(this.config.getSessionCookieName(), {
      httpOnly: true,
      secure: this.config.getCookieSecure(),
      sameSite: 'strict',
      path: '/',
    });
  }
}
