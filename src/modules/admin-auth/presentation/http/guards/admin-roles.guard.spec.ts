import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRolesGuard } from './admin-roles.guard';

describe('AdminRolesGuard', () => {
  const createExecutionContext = (request: unknown): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('allows access when route has no role requirements', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const audit = { write: jest.fn() };
    const guard = new AdminRolesGuard(
      reflector as unknown as Reflector,
      audit as never,
    );

    const allowed = await guard.canActivate(createExecutionContext({}));

    expect(allowed).toBe(true);
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('rejects and audits when role is insufficient', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    };
    const audit = { write: jest.fn() };
    const guard = new AdminRolesGuard(
      reflector as unknown as Reflector,
      audit as never,
    );
    const context = createExecutionContext({
      path: '/api/admin/logs/events',
      adminAuth: {
        user: {
          id: 10,
          role: 'SUPERVISOR',
        },
      },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it('allows access when user role is required', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'SUPERVISOR']),
    };
    const audit = { write: jest.fn() };
    const guard = new AdminRolesGuard(
      reflector as unknown as Reflector,
      audit as never,
    );
    const context = createExecutionContext({
      adminAuth: {
        user: {
          id: 1,
          role: 'ADMIN',
        },
      },
    });

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(audit.write).not.toHaveBeenCalled();
  });
});
