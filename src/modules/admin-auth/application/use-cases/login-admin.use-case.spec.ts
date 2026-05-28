import { UnauthorizedException } from '@nestjs/common';
import type { AdminAuthUserRepository } from '../../domain/ports/admin-auth-user.repository';
import type { AdminAuthSessionRepository } from '../../domain/ports/admin-auth-session.repository';
import { LoginAdminUseCase } from './login-admin.use-case';
import { AdminIdentifierNormalizerService } from '../services/admin-identifier-normalizer.service';

describe('LoginAdminUseCase', () => {
  const createDependencies = () => {
    const users: jest.Mocked<AdminAuthUserRepository> = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
    };

    const sessions: jest.Mocked<AdminAuthSessionRepository> = {
      create: jest.fn(),
      findActiveByTokenHash: jest.fn(),
      updateCsrfTokenHash: jest.fn(),
      revokeByTokenHash: jest.fn(),
      touchLastSeen: jest.fn(),
    };

    const config = {
      getSessionTtlHours: () => 12,
    };

    const hasher = {
      getDummyPasswordHash: () => 'dummy-hash',
      verifyPassword: jest.fn(),
    };

    const tokens = {
      generateOpaqueToken: jest.fn().mockReturnValueOnce('session-token').mockReturnValueOnce('csrf-token'),
      hashOpaqueToken: jest
        .fn()
        .mockReturnValueOnce('session-token-hash')
        .mockReturnValueOnce('csrf-token-hash'),
    };

    const cache = {
      set: jest.fn(),
    };

    const throttling = {
      isBlocked: jest.fn().mockResolvedValue(false),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    };

    const fingerprint = {
      hashIp: jest.fn().mockReturnValue('ip-hash'),
    };

    const audit = {
      write: jest.fn(),
    };

    const useCase = new LoginAdminUseCase(
      users,
      sessions,
      config as never,
      new AdminIdentifierNormalizerService(),
      hasher as never,
      tokens as never,
      cache as never,
      throttling as never,
      fingerprint as never,
      audit as never,
    );

    return {
      useCase,
      users,
      sessions,
      hasher,
      throttling,
      audit,
    };
  };

  it('returns generic UnauthorizedException when credentials fail', async () => {
    const { useCase, users, hasher, throttling } = createDependencies();
    users.findByEmail.mockResolvedValue(null);
    hasher.verifyPassword.mockReturnValue(false);

    await expect(
      useCase.execute({
        identifier: 'admin@sism.com.co',
        password: 'invalid',
        ipAddress: '127.0.0.1',
        userAgent: null,
      }),
    ).rejects.toEqual(new UnauthorizedException('Credenciales invalidas'));

    expect(throttling.recordFailure).toHaveBeenCalled();
  });

  it('creates session and returns user when credentials are valid', async () => {
    const { useCase, users, sessions, hasher, throttling } = createDependencies();
    users.findByEmail.mockResolvedValue({
      id: 7,
      email: 'admin@sism.com.co',
      username: 'admin',
      displayName: 'Admin SISM',
      passwordHash: 'stored-hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    hasher.verifyPassword.mockReturnValue(true);
    sessions.create.mockResolvedValue(10);

    const result = await useCase.execute({
      identifier: 'ADMIN@SISM.COM.CO',
      password: 'valid-secret',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(result.user.email).toBe('admin@sism.com.co');
    expect(result.user.username).toBe('admin');
    expect(result.sessionToken).toBe('session-token');
    expect(result.csrfToken).toBe('csrf-token');
    expect(throttling.clear).toHaveBeenCalled();
  });
});
