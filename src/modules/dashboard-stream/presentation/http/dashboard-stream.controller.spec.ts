import type { MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import { DashboardStreamService } from '../../application/services/dashboard-stream.service';
import { DashboardStreamController } from './dashboard-stream.controller';
import type { AdminAuthSessionRepository } from '../../../admin-auth/domain/ports/admin-auth-session.repository';

describe('DashboardStreamController', () => {
  const createSessionRepository =
    (): jest.Mocked<AdminAuthSessionRepository> => ({
      create: jest.fn(),
      findActiveByTokenHash: jest.fn(),
      updateCsrfTokenHash: jest.fn(),
      revokeByTokenHash: jest.fn(),
      touchLastSeen: jest.fn(),
    });

  const baseAdminAuth = {
    sessionId: 1,
    sessionTokenHash: 'session-hash',
    csrfTokenHash: 'csrf-hash',
    expiresAtIso: '2026-05-27T20:00:00.000Z',
    user: {
      id: 5,
      email: 'admin@sism.com.co',
      username: 'admin',
      displayName: 'Admin',
      role: 'SUPERVISOR' as const,
      status: 'ACTIVE' as const,
    },
  };

  const createResponse = (): Pick<Response, 'setHeader'> => ({
    setHeader: jest.fn(),
  });

  it('emits session revoked and completes when session is inactive', async () => {
    const streamService = new DashboardStreamService();
    const sessions = createSessionRepository();
    sessions.findActiveByTokenHash.mockResolvedValue(null);
    const controller = new DashboardStreamController(streamService, sessions);
    const response = createResponse();

    const events: MessageEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      controller.stream(baseAdminAuth, response as Response).subscribe({
        next: (event) => events.push(event),
        error: reject,
        complete: resolve,
      });
    });

    expect(events[0]?.type).toBe('auth.session.revoked');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('filters stream events by allowed roles', async () => {
    const streamService = new DashboardStreamService();
    const sessions = createSessionRepository();
    sessions.findActiveByTokenHash.mockResolvedValue({
      session: {
        id: 1,
        userId: 5,
        sessionTokenHash: 'session-hash',
        csrfTokenHash: 'csrf-hash',
        ipHash: null,
        userAgent: null,
        lastSeenAt: null,
        expiresAt: '2026-05-27T20:00:00.000Z',
        revokedAt: null,
      },
      user: {
        id: 5,
        email: 'admin@sism.com.co',
        username: 'admin',
        displayName: 'Admin',
        role: 'SUPERVISOR',
        status: 'ACTIVE',
      },
    });
    const controller = new DashboardStreamController(streamService, sessions);
    const response = createResponse();
    const events: MessageEvent[] = [];
    const subscription = controller
      .stream(baseAdminAuth, response as Response)
      .subscribe({
        next: (event) => events.push(event),
      });

    streamService.publish({
      type: 'message.inbound',
      occurredAtIso: '2026-05-27T16:00:00.000Z',
      visibleRoles: ['ADMIN'],
      data: { summary: 'Solo ADMIN' },
    });
    streamService.publish({
      type: 'message.outbound',
      occurredAtIso: '2026-05-27T16:00:01.000Z',
      visibleRoles: ['SUPERVISOR'],
      data: { summary: 'Visible SUPERVISOR' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(events.some((event) => event.type === 'message.inbound')).toBe(
      false,
    );
    expect(events.some((event) => event.type === 'message.outbound')).toBe(
      true,
    );
  });
});
