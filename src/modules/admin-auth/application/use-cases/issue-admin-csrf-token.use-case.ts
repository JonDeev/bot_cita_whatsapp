import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ADMIN_AUTH_SESSION_REPOSITORY } from '../../domain/admin-auth.tokens';
import type { AdminAuthSessionRepository } from '../../domain/ports/admin-auth-session.repository';
import type { AuthenticatedAdminContext } from '../../presentation/http/admin-auth-request';
import { AdminSessionCacheService } from '../services/admin-session-cache.service';
import { AdminTokenService } from '../services/admin-token.service';
import { AdminAuthAuditService } from '../services/admin-auth-audit.service';

export interface IssueAdminCsrfTokenResult {
  csrfToken: string;
}

@Injectable()
export class IssueAdminCsrfTokenUseCase {
  constructor(
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
    private readonly tokenService: AdminTokenService,
    private readonly sessionCache: AdminSessionCacheService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminAuth: AuthenticatedAdminContext | undefined,
  ): Promise<IssueAdminCsrfTokenResult> {
    if (!adminAuth) {
      throw new UnauthorizedException('Missing authenticated admin context.');
    }

    const csrfToken = this.tokenService.generateOpaqueToken();
    const csrfTokenHash = this.tokenService.hashOpaqueToken(csrfToken);

    await this.sessions.updateCsrfTokenHash(adminAuth.sessionId, csrfTokenHash);

    const now = new Date();
    const ttlSeconds = Math.max(
      1,
      Math.floor(
        (new Date(adminAuth.expiresAtIso).getTime() - now.getTime()) / 1000,
      ),
    );

    await this.sessionCache.set(
      adminAuth.sessionTokenHash,
      {
        sessionId: adminAuth.sessionId,
        userId: adminAuth.user.id,
        role: adminAuth.user.role,
        status: adminAuth.user.status,
        email: adminAuth.user.email,
        username: adminAuth.user.username,
        displayName: adminAuth.user.displayName,
        csrfTokenHash,
        expiresAtIso: adminAuth.expiresAtIso,
      },
      ttlSeconds,
    );

    await this.audit.write({
      adminUserId: adminAuth.user.id,
      action: 'admin.auth.csrf_issued',
      metadata: {
        sessionId: adminAuth.sessionId,
      },
    });

    return { csrfToken };
  }
}
