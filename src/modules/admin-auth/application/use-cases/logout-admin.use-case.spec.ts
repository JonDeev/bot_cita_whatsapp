import { UnauthorizedException } from '@nestjs/common';
import type { AdminAuthSessionRepository } from '../../domain/ports/admin-auth-session.repository';
import { LogoutAdminUseCase } from './logout-admin.use-case';

describe('LogoutAdminUseCase', () => {
  const createDependencies = () => {
    const sessions: jest.Mocked<AdminAuthSessionRepository> = {
      create: jest.fn(),
      findActiveByTokenHash: jest.fn(),
      updateCsrfTokenHash: jest.fn(),
      revokeByTokenHash: jest.fn().mockResolvedValue(undefined),
      touchLastSeen: jest.fn(),
    };

    const cache = {
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const audit = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new LogoutAdminUseCase(
      sessions,
      cache as never,
      audit as never,
    );

    return {
      useCase,
      sessions,
      cache,
      audit,
    };
  };

  it('revokes session and writes logout + session_revoked audit events', async () => {
    const { useCase, sessions, cache, audit } = createDependencies();

    await useCase.execute({
      sessionId: 22,
      sessionTokenHash: 'token-hash',
      csrfTokenHash: 'csrf-hash',
      expiresAtIso: '2026-05-28T00:00:00.000Z',
      user: {
        id: 5,
        email: 'admin@sism.com.co',
        username: 'admin',
        displayName: 'Admin SISM',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    expect(sessions.revokeByTokenHash.mock.calls).toHaveLength(1);
    expect(cache.delete).toHaveBeenCalledWith('token-hash');
    expect(audit.write).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        adminUserId: 5,
        action: 'admin.auth.logout',
      }),
    );
    expect(audit.write).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        adminUserId: 5,
        action: 'admin.auth.session_revoked',
        metadata: {
          sessionId: 22,
          reason: 'logout',
        },
      }),
    );
  });

  it('rejects when admin context is missing', async () => {
    const { useCase } = createDependencies();

    await expect(useCase.execute(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
