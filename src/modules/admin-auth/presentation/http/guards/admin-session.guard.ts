import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ADMIN_AUTH_SESSION_REPOSITORY } from '../../../domain/admin-auth.tokens';
import type { AdminAuthSessionRepository } from '../../../domain/ports/admin-auth-session.repository';
import { AdminAuthConfigService } from '../../../application/services/admin-auth-config.service';
import { AdminSessionCacheService } from '../../../application/services/admin-session-cache.service';
import { AdminTokenService } from '../../../application/services/admin-token.service';
import type { AdminAuthRequest } from '../admin-auth-request';
import { parseCookieHeader } from '../cookie-parser';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly config: AdminAuthConfigService,
    private readonly cache: AdminSessionCacheService,
    private readonly tokenService: AdminTokenService,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthRequest>();
    const cookieHeader = request.headers.cookie;
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[this.config.getSessionCookieName()];
    if (!token) {
      throw new UnauthorizedException('Missing admin session.');
    }

    const tokenHash = this.tokenService.hashOpaqueToken(token);
    const now = new Date();

    const cached = await this.cache.get(tokenHash);
    if (cached && new Date(cached.expiresAtIso).getTime() > now.getTime()) {
      request.adminAuth = {
        sessionId: cached.sessionId,
        sessionTokenHash: tokenHash,
        csrfTokenHash: cached.csrfTokenHash,
        expiresAtIso: cached.expiresAtIso,
        user: {
          id: cached.userId,
          email: cached.email,
          username: cached.username,
          displayName: cached.displayName,
          role: cached.role,
          status: cached.status,
        },
      };

      return true;
    }

    const sessionContext = await this.sessions.findActiveByTokenHash(
      tokenHash,
      now.toISOString(),
    );
    if (!sessionContext || sessionContext.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid admin session.');
    }

    const ttlSeconds = Math.max(
      1,
      Math.floor(
        (new Date(sessionContext.session.expiresAt).getTime() - now.getTime()) /
          1000,
      ),
    );

    await this.cache.set(
      tokenHash,
      {
        sessionId: sessionContext.session.id,
        userId: sessionContext.user.id,
        role: sessionContext.user.role,
        status: sessionContext.user.status,
        email: sessionContext.user.email,
        username: sessionContext.user.username,
        displayName: sessionContext.user.displayName,
        csrfTokenHash: sessionContext.session.csrfTokenHash,
        expiresAtIso: sessionContext.session.expiresAt,
      },
      ttlSeconds,
    );

    request.adminAuth = {
      sessionId: sessionContext.session.id,
      sessionTokenHash: tokenHash,
      csrfTokenHash: sessionContext.session.csrfTokenHash,
      expiresAtIso: sessionContext.session.expiresAt,
      user: {
        id: sessionContext.user.id,
        email: sessionContext.user.email,
        username: sessionContext.user.username,
        displayName: sessionContext.user.displayName,
        role: sessionContext.user.role,
        status: sessionContext.user.status,
      },
    };

    await this.sessions.touchLastSeen(sessionContext.session.id, now.toISOString());

    return true;
  }
}
