import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { ADMIN_OVERVIEW_REPOSITORY } from '../../../admin-overview/domain/admin-overview.tokens';
import type {
  AdminLiveFeedEventType,
  AdminLiveFeedItem,
} from '../../../admin-overview/domain/admin-overview.types';
import type { AdminOverviewRepository } from '../../../admin-overview/domain/ports/admin-overview.repository';
import { DashboardStreamService } from './dashboard-stream.service';

const DASHBOARD_STREAM_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];
const POLL_INTERVAL_MS = 15_000;
const LOOKBACK_WINDOW_MS = 15 * 60_000;
const LIVE_FEED_LIMIT = 100;
const PUBLISHED_EVENT_TTL_MS = 30 * 60_000;
const SYSTEM_DEGRADED_COOLDOWN_MS = 2 * 60_000;

const CRITICAL_EVENT_TYPES: ReadonlySet<AdminLiveFeedEventType> = new Set([
  'outbox.failed',
  'webhook.failed',
  'reminder.failed',
]);

@Injectable()
export class DashboardStreamPollerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private readonly publishedEventIds = new Map<string, number>();
  private lastSystemDegradedAtMs = 0;

  constructor(
    @Inject(ADMIN_OVERVIEW_REPOSITORY)
    private readonly overviewRepository: AdminOverviewRepository,
    private readonly streamService: DashboardStreamService,
  ) {}

  onModuleInit(): void {
    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async pollOnce(now: Date = new Date()): Promise<void> {
    const nowMs = now.getTime();
    this.prunePublishedEventIds(nowMs);

    try {
      const windowStart = new Date(nowMs - LOOKBACK_WINDOW_MS);
      const items = await this.overviewRepository.getRecentLiveFeed(
        windowStart,
        LIVE_FEED_LIMIT,
      );

      this.publishNewFeedItems(items);
      this.publishSystemDegradedFromFeed(items, nowMs);
    } catch {
      this.publishSystemDegraded(
        nowMs,
        'No fue posible refrescar el stream operativo en tiempo real.',
      );
    }
  }

  private publishNewFeedItems(items: AdminLiveFeedItem[]): void {
    const pendingItems = items
      .filter((item) => !this.publishedEventIds.has(item.eventId))
      .sort((left, right) => left.occurredAtIso.localeCompare(right.occurredAtIso));

    for (const item of pendingItems) {
      this.streamService.publish({
        type: item.eventType,
        occurredAtIso: item.occurredAtIso,
        visibleRoles: DASHBOARD_STREAM_ROLES,
        data: {
          eventId: item.eventId,
          summary: item.summary,
          severity: item.severity,
          conversationId: item.conversationId,
        },
      });

      this.publishedEventIds.set(item.eventId, Date.now());
    }
  }

  private publishSystemDegradedFromFeed(
    items: AdminLiveFeedItem[],
    nowMs: number,
  ): void {
    const criticalEvents = items.filter((item) =>
      CRITICAL_EVENT_TYPES.has(item.eventType),
    );
    if (criticalEvents.length === 0) {
      return;
    }

    this.publishSystemDegraded(
      nowMs,
      `Se detectaron ${criticalEvents.length} eventos criticos recientes.`,
    );
  }

  private publishSystemDegraded(nowMs: number, summary: string): void {
    if (nowMs - this.lastSystemDegradedAtMs < SYSTEM_DEGRADED_COOLDOWN_MS) {
      return;
    }

    this.lastSystemDegradedAtMs = nowMs;

    this.streamService.publish({
      type: 'system.degraded',
      occurredAtIso: new Date(nowMs).toISOString(),
      visibleRoles: DASHBOARD_STREAM_ROLES,
      data: {
        summary,
        severity: 'warning',
      },
    });
  }

  private prunePublishedEventIds(nowMs: number): void {
    for (const [eventId, publishedAtMs] of this.publishedEventIds.entries()) {
      if (nowMs - publishedAtMs > PUBLISHED_EVENT_TTL_MS) {
        this.publishedEventIds.delete(eventId);
      }
    }
  }
}
