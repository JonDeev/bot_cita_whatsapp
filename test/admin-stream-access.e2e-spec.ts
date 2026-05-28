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
import { ADMIN_AUTH_SESSION_REPOSITORY } from '../src/modules/admin-auth/domain/admin-auth.tokens';
import { AdminAuthAuditService } from '../src/modules/admin-auth/application/services/admin-auth-audit.service';
import { AdminRolesGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../src/modules/admin-auth/presentation/http/guards/admin-session.guard';
import { DashboardStreamService } from '../src/modules/dashboard-stream/application/services/dashboard-stream.service';
import { DashboardStreamController } from '../src/modules/dashboard-stream/presentation/http/dashboard-stream.controller';

type TestRole = 'ADMIN' | 'SUPERVISOR' | 'ASESOR';

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
          role: TestRole;
          status: 'ACTIVE';
        };
      };
    }>();

    const authHeader = request.headers['x-test-auth'];
    if (authHeader !== '1') {
      throw new UnauthorizedException('Missing admin session.');
    }

    const roleHeader = request.headers['x-test-role'];
    const role: TestRole =
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

describe('Admin Stream Access (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardStreamController],
      providers: [
        DashboardStreamService,
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
          provide: ADMIN_AUTH_SESSION_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findActiveByTokenHash: jest.fn().mockResolvedValue(null),
            updateCsrfTokenHash: jest.fn(),
            revokeByTokenHash: jest.fn(),
            touchLastSeen: jest.fn(),
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

  it('denies stream access without session', async () => {
    await request(app.getHttpServer()).get('/api/admin/stream').expect(401);
  });

  it('denies stream access with insufficient role', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/stream')
      .set('X-Test-Auth', '1')
      .set('X-Test-Role', 'ASESOR')
      .expect(403);
  });

  it('opens stream for allowed role and emits session revoked event', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/stream')
      .set('X-Test-Auth', '1')
      .set('X-Test-Role', 'ADMIN')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['x-accel-buffering']).toBe('no');
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['pragma']).toContain('no-cache');
    expect(response.text).toContain('auth.session.revoked');
  });
});
