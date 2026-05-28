import { DashboardStreamPollerService } from './dashboard-stream-poller.service';
import type { AdminOverviewRepository } from '../../../admin-overview/domain/ports/admin-overview.repository';
import type { DashboardStreamService } from './dashboard-stream.service';

describe('DashboardStreamPollerService', () => {
  function buildService(feedItems: Awaited<ReturnType<AdminOverviewRepository['getRecentLiveFeed']>>) {
    const repository: jest.Mocked<AdminOverviewRepository> = {
      getAggregateCounts: jest.fn(),
      getRecentLiveFeed: jest.fn().mockResolvedValue(feedItems),
    };

    const stream: jest.Mocked<DashboardStreamService> = {
      stream: jest.fn(),
      publish: jest.fn(),
    } as unknown as jest.Mocked<DashboardStreamService>;

    const service = new DashboardStreamPollerService(repository, stream);

    return { service, repository, stream };
  }

  it('publishes unseen feed events only once across polls', async () => {
    const nowIso = '2026-05-27T16:00:00.000Z';
    const { service, stream } = buildService([
      {
        eventId: 'message-1',
        eventType: 'message.inbound',
        occurredAtIso: nowIso,
        severity: 'info',
        summary: 'Mensaje entrante',
        conversationId: 10,
      },
    ]);

    await service.pollOnce(new Date(nowIso));
    await service.pollOnce(new Date(nowIso));

    expect(stream.publish).toHaveBeenCalledTimes(1);
  });

  it('emits system.degraded with cooldown for repeated critical feed', async () => {
    const base = new Date('2026-05-27T16:00:00.000Z');
    const { service, stream } = buildService([
      {
        eventId: 'outbox-1',
        eventType: 'outbox.failed',
        occurredAtIso: base.toISOString(),
        severity: 'error',
        summary: 'Fallo outbox',
        conversationId: 2,
      },
    ]);

    await service.pollOnce(base);
    await service.pollOnce(new Date(base.getTime() + 30_000));
    await service.pollOnce(new Date(base.getTime() + 3 * 60_000));

    const degradedEvents = stream.publish.mock.calls.filter(
      ([event]) => event.type === 'system.degraded',
    );

    expect(degradedEvents).toHaveLength(2);
  });
});
