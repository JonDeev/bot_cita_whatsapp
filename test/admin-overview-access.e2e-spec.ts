import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminAuthAuditService } from '../src/modules/admin-auth/application/services/admin-auth-audit.service';
import { AdminSessionGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-session.guard';
import { AdminRolesGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-roles.guard';
import { GetAdminLiveFeedUseCase } from '../src/modules/admin-overview/application/use-cases/get-admin-live-feed.use-case';
import { GetAdminOverviewUseCase } from '../src/modules/admin-overview/application/use-cases/get-admin-overview.use-case';
import { AdminOverviewController } from '../src/modules/admin-overview/presentation/http/admin-overview.controller';

class HeaderDrivenSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
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
          role: 'ADMIN' | 'SUPERVISOR' | 'ASESOR';
          status: 'ACTIVE';
        };
      };
    }>();

    const authHeader = request.headers['x-test-auth'];
    const isAuthenticated = authHeader === '1';
    if (!isAuthenticated) {
      throw new UnauthorizedException('Missing admin session.');
    }

    const roleHeader = request.headers['x-test-role'];
    const role =
      roleHeader === 'SUPERVISOR' || roleHeader === 'ASESOR'
        ? roleHeader
        : 'ADMIN';

    request.adminAuth = {
      sessionId: 10,
      sessionTokenHash: 'session-hash',
      csrfTokenHash: 'csrf-hash',
      expiresAtIso: '2026-05-28T00:00:00.000Z',
      user: {
        id: 1,
        email: 'admin@sism.com.co',
        username: 'admin',
        displayName: 'Admin SISM',
        role,
        status: 'ACTIVE',
      },
    };

    return true;
  }
}

describe('Admin Overview Access (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminOverviewController],
      providers: [
        Reflector,
        AdminRolesGuard,
        {
          provide: AdminAuthAuditService,
          useValue: {
            write: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AdminSessionGuard,
          useClass: HeaderDrivenSessionGuard,
        },
        {
          provide: GetAdminOverviewUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              generatedAtIso: '2026-05-27T16:00:00.000Z',
              lookbackHours: 24,
              inboundMessages: 10,
              outboundMessages: 8,
              outboxFailed: 1,
              webhookFailed: 0,
              activeConversations: 4,
              reminderDispatches: [],
              surveyDispatches: [],
            }),
          },
        },
        {
          provide: GetAdminLiveFeedUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              generatedAtIso: '2026-05-27T16:00:00.000Z',
              lookbackHours: 24,
              limit: 50,
              items: [],
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows overview access with valid session and allowed role', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('X-Test-Auth', '1')
      .set('X-Test-Role', 'ADMIN')
      .expect(200);
  });

  it('denies overview access without session', async () => {
    await request(app.getHttpServer()).get('/api/admin/overview').expect(401);
  });

  it('denies overview access with insufficient role', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('X-Test-Auth', '1')
      .set('X-Test-Role', 'ASESOR')
      .expect(403);
  });
});
