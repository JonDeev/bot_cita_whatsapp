import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AdminAuthMeResponseDto } from '@whatsapp-bot/shared';
import { ADMIN_AUTH_USER_REPOSITORY, ADMIN_AUTH_SESSION_REPOSITORY } from '../../domain/admin-auth.tokens';
import type { AdminAuthUserRepository } from '../../domain/ports/admin-auth-user.repository';
import type { AdminAuthSessionRepository } from '../../domain/ports/admin-auth-session.repository';
import { AdminAuthConfigService } from '../services/admin-auth-config.service';
import { AdminIdentifierNormalizerService } from '../services/admin-identifier-normalizer.service';
import { AdminPasswordHasherService } from '../services/admin-password-hasher.service';
import { AdminTokenService } from '../services/admin-token.service';
import { AdminSessionCacheService } from '../services/admin-session-cache.service';
import { AdminLoginThrottleService } from '../services/admin-login-throttle.service';
import { AdminFingerprintService } from '../services/admin-fingerprint.service';
import { AdminAuthAuditService } from '../services/admin-auth-audit.service';

export interface LoginAdminInput {
  identifier: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginAdminResult {
  user: AdminAuthMeResponseDto;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

@Injectable()
export class LoginAdminUseCase {
  constructor(
    @Inject(ADMIN_AUTH_USER_REPOSITORY)
    private readonly users: AdminAuthUserRepository,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
    private readonly config: AdminAuthConfigService,
    private readonly normalizer: AdminIdentifierNormalizerService,
    private readonly hasher: AdminPasswordHasherService,
    private readonly tokens: AdminTokenService,
    private readonly cache: AdminSessionCacheService,
    private readonly throttling: AdminLoginThrottleService,
    private readonly fingerprint: AdminFingerprintService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(input: LoginAdminInput): Promise<LoginAdminResult> {
    const identifier = this.normalizer.normalizeIdentifier(input.identifier);
    const ipKey = input.ipAddress?.trim() || 'unknown';

    const blocked = await this.throttling.isBlocked(ipKey, identifier);
    if (blocked) {
      await this.audit.write({
        action: 'admin.auth.login_failed',
        metadata: {
          identifier,
          blocked: true,
        },
        ipHash: this.fingerprint.hashIp(input.ipAddress),
      });
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const user = this.normalizer.isEmailIdentifier(identifier)
      ? await this.users.findByEmail(identifier)
      : await this.users.findByUsername(identifier);

    const hashCandidate = user?.passwordHash ?? this.hasher.getDummyPasswordHash();
    const passwordValid = this.hasher.verifyPassword(hashCandidate, input.password);

    if (!user || user.status !== 'ACTIVE' || !passwordValid) {
      await this.throttling.recordFailure(ipKey, identifier);
      await this.audit.write({
        adminUserId: user?.id ?? null,
        action: 'admin.auth.login_failed',
        metadata: {
          identifier,
          blocked: false,
        },
        ipHash: this.fingerprint.hashIp(input.ipAddress),
      });
      throw new UnauthorizedException('Credenciales invalidas');
    }

    await this.throttling.clear(ipKey, identifier);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.getSessionTtlHours() * 60 * 60 * 1000,
    );
    const sessionToken = this.tokens.generateOpaqueToken();
    const sessionTokenHash = this.tokens.hashOpaqueToken(sessionToken);
    const csrfToken = this.tokens.generateOpaqueToken();
    const csrfTokenHash = this.tokens.hashOpaqueToken(csrfToken);
    const ipHash = this.fingerprint.hashIp(input.ipAddress);

    const sessionId = await this.sessions.create({
      userId: user.id,
      sessionTokenHash,
      csrfTokenHash,
      ipHash,
      userAgent: input.userAgent,
      expiresAtIso: expiresAt.toISOString(),
    });

    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );

    await this.cache.set(
      sessionTokenHash,
      {
        sessionId,
        userId: user.id,
        role: user.role,
        status: user.status,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        csrfTokenHash,
        expiresAtIso: expiresAt.toISOString(),
      },
      ttlSeconds,
    );

    await this.audit.write({
      adminUserId: user.id,
      action: 'admin.auth.login_succeeded',
      metadata: {
        identifier,
      },
      ipHash,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
      sessionToken,
      csrfToken,
      expiresAt,
    };
  }
}
