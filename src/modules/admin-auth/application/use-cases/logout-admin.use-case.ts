import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ADMIN_AUTH_SESSION_REPOSITORY } from '../../domain/admin-auth.tokens';
import type { AdminAuthSessionRepository } from '../../domain/ports/admin-auth-session.repository';
import type { AuthenticatedAdminContext } from '../../presentation/http/admin-auth-request';
import { AdminSessionCacheService } from '../services/admin-session-cache.service';
import { AdminAuthAuditService } from '../services/admin-auth-audit.service';

@Injectable()
export class LogoutAdminUseCase {
  constructor(
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
    private readonly cache: AdminSessionCacheService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminAuth: AuthenticatedAdminContext | undefined,
  ): Promise<void> {
    if (!adminAuth) {
      throw new UnauthorizedException('Missing authenticated admin context.');
    }

    const nowIso = new Date().toISOString();
    await this.sessions.revokeByTokenHash(adminAuth.sessionTokenHash, nowIso);
    await this.cache.delete(adminAuth.sessionTokenHash);
    await this.audit.write({
      adminUserId: adminAuth.user.id,
      action: 'admin.auth.logout',
      metadata: {
        sessionId: adminAuth.sessionId,
      },
    });
    await this.audit.write({
      adminUserId: adminAuth.user.id,
      action: 'admin.auth.session_revoked',
      metadata: {
        sessionId: adminAuth.sessionId,
        reason: 'logout',
      },
    });
  }
}
