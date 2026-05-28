import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminCsrfGuard } from './admin-csrf.guard';

describe('AdminCsrfGuard', () => {
  const createExecutionContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('rejects requests without authenticated admin context', () => {
    const guard = new AdminCsrfGuard({ matchesHash: jest.fn() } as never);
    const context = createExecutionContext({ headers: {} });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects requests with invalid csrf token', () => {
    const tokenService = { matchesHash: jest.fn().mockReturnValue(false) };
    const guard = new AdminCsrfGuard(tokenService as never);
    const context = createExecutionContext({
      headers: {
        'x-csrf-token': 'invalid',
      },
      adminAuth: {
        csrfTokenHash: 'stored-hash',
      },
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(tokenService.matchesHash).toHaveBeenCalledWith(
      'invalid',
      'stored-hash',
    );
  });

  it('accepts request when csrf token matches', () => {
    const tokenService = { matchesHash: jest.fn().mockReturnValue(true) };
    const guard = new AdminCsrfGuard(tokenService as never);
    const context = createExecutionContext({
      headers: {
        'x-csrf-token': 'valid-token',
      },
      adminAuth: {
        csrfTokenHash: 'stored-hash',
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
