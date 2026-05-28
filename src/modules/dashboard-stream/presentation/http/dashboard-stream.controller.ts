import {
  Controller,
  Inject,
  MessageEvent,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AdminRole } from '@whatsapp-bot/shared';
import { Observable, Subscription } from 'rxjs';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { ADMIN_AUTH_SESSION_REPOSITORY } from '../../../admin-auth/domain/admin-auth.tokens';
import type { AdminAuthSessionRepository } from '../../../admin-auth/domain/ports/admin-auth-session.repository';
import { DashboardStreamService } from '../../application/services/dashboard-stream.service';

const DASHBOARD_STREAM_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];
const HEARTBEAT_INTERVAL_MS = 15000;

@Controller('api/admin')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...DASHBOARD_STREAM_ROLES)
export class DashboardStreamController {
  constructor(
    private readonly streamService: DashboardStreamService,
    @Inject(ADMIN_AUTH_SESSION_REPOSITORY)
    private readonly sessions: AdminAuthSessionRepository,
  ) {}

  @Sse('stream')
  stream(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Res({ passthrough: true }) response: Response,
  ): Observable<MessageEvent> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('X-Accel-Buffering', 'no');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    return new Observable<MessageEvent>((subscriber) => {
      if (!adminAuth) {
        subscriber.complete();
        return;
      }

      let closed = false;
      let streamSubscription: Subscription | null = null;

      const heartbeatTick = async () => {
        if (closed) {
          return;
        }

        const active = await this.sessions.findActiveByTokenHash(
          adminAuth.sessionTokenHash,
          new Date().toISOString(),
        );
        if (!active) {
          subscriber.next({
            type: 'auth.session.revoked',
            data: {
              eventType: 'auth.session.revoked',
              occurredAtIso: new Date().toISOString(),
            },
          });
          subscriber.complete();
          return;
        }

        subscriber.next({
          type: 'heartbeat',
          data: {
            eventType: 'heartbeat',
            occurredAtIso: new Date().toISOString(),
          },
        });
      };

      streamSubscription = this.streamService.stream().subscribe((event) => {
        if (closed) {
          return;
        }

        if (
          event.visibleRoles &&
          !event.visibleRoles.includes(adminAuth.user.role)
        ) {
          return;
        }

        subscriber.next({
          type: event.type,
          data: {
            ...event.data,
            eventType: event.type,
            occurredAtIso: event.occurredAtIso,
          },
        });
      });

      void heartbeatTick();
      const timer = setInterval(() => {
        void heartbeatTick();
      }, HEARTBEAT_INTERVAL_MS);

      return () => {
        closed = true;
        if (streamSubscription) {
          streamSubscription.unsubscribe();
        }
        clearInterval(timer);
      };
    });
  }
}
