import { GetAdminLiveFeedUseCase } from './get-admin-live-feed.use-case';
import type { AdminOverviewRepository } from '../../domain/ports/admin-overview.repository';

describe('GetAdminLiveFeedUseCase', () => {
  it('returns configured limit and live feed items', async () => {
    const repository: jest.Mocked<AdminOverviewRepository> = {
      getAggregateCounts: jest.fn(),
      getRecentLiveFeed: jest.fn().mockResolvedValue([
        {
          eventId: 'message-1',
          eventType: 'message.inbound',
          occurredAtIso: new Date().toISOString(),
          severity: 'info',
          summary: 'Mensaje inbound',
          conversationId: 1,
        },
        {
          eventId: 'system-1',
          eventType: 'system.degraded',
          occurredAtIso: new Date().toISOString(),
          severity: 'warning',
          summary: 'Sistema degradado',
          conversationId: null,
        },
      ]),
    };

    const useCase = new GetAdminLiveFeedUseCase(repository, {
      getLookbackHours: () => 24,
      getLiveFeedLimit: () => 50,
    } as never);

    const result = await useCase.execute();
    expect(result.lookbackHours).toBe(24);
    expect(result.limit).toBe(50);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]?.eventType).toBe('system.degraded');
  });
});
