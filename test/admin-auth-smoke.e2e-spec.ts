import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminIdentifierNormalizerService } from '../src/modules/admin-auth/application/services/admin-identifier-normalizer.service';
import { GetAdminAuthMeUseCase } from '../src/modules/admin-auth/application/use-cases/get-admin-auth-me.use-case';
import { IssueAdminCsrfTokenUseCase } from '../src/modules/admin-auth/application/use-cases/issue-admin-csrf-token.use-case';
import { LoginAdminUseCase } from '../src/modules/admin-auth/application/use-cases/login-admin.use-case';
import { LogoutAdminUseCase } from '../src/modules/admin-auth/application/use-cases/logout-admin.use-case';
import { AdminAuthController } from '../src/modules/admin-auth/presentation/http/admin-auth.controller';
import { AdminSessionCookieService } from '../src/modules/admin-auth/application/services/admin-session-cookie.service';
import { AdminSessionGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-session.guard';
import { AdminCsrfGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-csrf.guard';

class AlwaysAllowSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      adminAuth?: {
        sessionId: number;
        sessionTokenHash: string;
        csrfTokenHash: string;
        expiresAtIso: string;
        user: {
          id: number;
          email: string;
          username: string;
          displayName: string;
          role: 'ADMIN';
          status: 'ACTIVE';
        };
      };
    }>();

    request.adminAuth = {
      sessionId: 100,
      sessionTokenHash: 'session-hash',
      csrfTokenHash: 'csrf-hash',
      expiresAtIso: '2026-05-28T00:00:00.000Z',
      user: {
        id: 1,
        email: 'admin@sism.com.co',
        username: 'admin',
        displayName: 'Admin SISM',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    };

    return true;
  }
}

class AlwaysAllowCsrfGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('Admin Auth Smoke (e2e)', () => {
  let app: INestApplication<App>;

  interface LoginResponseBody {
    user: {
      username: string;
    };
  }

  interface ErrorResponseBody {
    message: string;
  }

  const loginUseCase = {
    execute: jest.fn(),
  };

  const cookieService = {
    setSessionCookie: jest.fn(),
    clearSessionCookie: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        AdminIdentifierNormalizerService,
        {
          provide: LoginAdminUseCase,
          useValue: loginUseCase,
        },
        {
          provide: GetAdminAuthMeUseCase,
          useValue: {
            execute: jest.fn().mockReturnValue({
              id: 1,
              email: 'admin@sism.com.co',
              username: 'admin',
              displayName: 'Admin SISM',
              role: 'ADMIN',
              status: 'ACTIVE',
            }),
          },
        },
        {
          provide: IssueAdminCsrfTokenUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ csrfToken: 'csrf-token' }),
          },
        },
        {
          provide: LogoutAdminUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AdminSessionCookieService,
          useValue: cookieService,
        },
        {
          provide: AdminSessionGuard,
          useClass: AlwaysAllowSessionGuard,
        },
        {
          provide: AdminCsrfGuard,
          useClass: AlwaysAllowCsrfGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('logs in successfully with valid credentials', async () => {
    loginUseCase.execute.mockResolvedValue({
      user: {
        id: 1,
        email: 'admin@sism.com.co',
        username: 'admin',
        displayName: 'Admin SISM',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      sessionToken: 'session-token',
      csrfToken: 'csrf-token',
      expiresAt: new Date('2026-05-28T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        identifier: 'admin',
        password: 'valid-password',
      })
      .expect(201);

    const body = response.body as LoginResponseBody;
    expect(body.user.username).toBe('admin');
    expect(cookieService.setSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('returns generic error on invalid login', async () => {
    loginUseCase.execute.mockRejectedValue(
      new UnauthorizedException('Credenciales invalidas'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        identifier: 'admin',
        password: 'invalid-password',
      })
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expect(body.message).toContain('Credenciales invalidas');
  });

  it('logs out and clears session cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/auth/logout')
      .set('X-CSRF-Token', 'csrf-token')
      .expect(201);

    expect(cookieService.clearSessionCookie).toHaveBeenCalledTimes(1);
  });
});
