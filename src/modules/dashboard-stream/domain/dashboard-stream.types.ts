import type { AdminLiveFeedEventType } from '../../admin-overview/domain/admin-overview.types';
import type { AdminRole } from '@whatsapp-bot/shared';

export type DashboardStreamEventType =
  | AdminLiveFeedEventType
  | 'auth.session.revoked'
  | 'heartbeat';

export interface DashboardStreamEvent {
  type: DashboardStreamEventType;
  data: Record<string, unknown>;
  occurredAtIso: string;
  visibleRoles?: AdminRole[];
}
