import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { RedisModule } from '../../shared/infrastructure/redis/redis.module';
import {
  ADMIN_AUTH_AUDIT_REPOSITORY,
  ADMIN_AUTH_SESSION_REPOSITORY,
  ADMIN_AUTH_USER_REPOSITORY,
} from './domain/admin-auth.tokens';
import { AdminAuthConfigService } from './application/services/admin-auth-config.service';
import { AdminIdentifierNormalizerService } from './application/services/admin-identifier-normalizer.service';
import { AdminPasswordHasherService } from './application/services/admin-password-hasher.service';
import { AdminTokenService } from './application/services/admin-token.service';
import { AdminSessionCookieService } from './application/services/admin-session-cookie.service';
import { AdminSessionCacheService } from './application/services/admin-session-cache.service';
import { AdminLoginThrottleService } from './application/services/admin-login-throttle.service';
import { AdminFingerprintService } from './application/services/admin-fingerprint.service';
import { AdminAuthAuditService } from './application/services/admin-auth-audit.service';
import { LoginAdminUseCase } from './application/use-cases/login-admin.use-case';
import { GetAdminAuthMeUseCase } from './application/use-cases/get-admin-auth-me.use-case';
import { IssueAdminCsrfTokenUseCase } from './application/use-cases/issue-admin-csrf-token.use-case';
import { LogoutAdminUseCase } from './application/use-cases/logout-admin.use-case';
import { PrismaBotAdminAuthUserRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-auth-user.repository';
import { PrismaBotAdminAuthSessionRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-auth-session.repository';
import { PrismaBotAdminAuthAuditRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-auth-audit.repository';
import { AdminAuthController } from './presentation/http/admin-auth.controller';
import { AdminSessionGuard } from './presentation/http/guards/admin-session.guard';
import { AdminCsrfGuard } from './presentation/http/guards/admin-csrf.guard';
import { AdminRolesGuard } from './presentation/http/guards/admin-roles.guard';

@Module({
  imports: [PrismaBotModule, RedisModule],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthConfigService,
    AdminIdentifierNormalizerService,
    AdminPasswordHasherService,
    AdminTokenService,
    AdminSessionCookieService,
    AdminSessionCacheService,
    AdminLoginThrottleService,
    AdminFingerprintService,
    AdminAuthAuditService,
    LoginAdminUseCase,
    GetAdminAuthMeUseCase,
    IssueAdminCsrfTokenUseCase,
    LogoutAdminUseCase,
    AdminSessionGuard,
    AdminCsrfGuard,
    AdminRolesGuard,
    {
      provide: ADMIN_AUTH_USER_REPOSITORY,
      useClass: PrismaBotAdminAuthUserRepository,
    },
    {
      provide: ADMIN_AUTH_SESSION_REPOSITORY,
      useClass: PrismaBotAdminAuthSessionRepository,
    },
    {
      provide: ADMIN_AUTH_AUDIT_REPOSITORY,
      useClass: PrismaBotAdminAuthAuditRepository,
    },
  ],
  exports: [
    AdminAuthConfigService,
    AdminTokenService,
    AdminSessionCacheService,
    ADMIN_AUTH_SESSION_REPOSITORY,
    AdminSessionGuard,
    AdminCsrfGuard,
    AdminRolesGuard,
    AdminAuthAuditService,
  ],
})
export class AdminAuthModule {}
