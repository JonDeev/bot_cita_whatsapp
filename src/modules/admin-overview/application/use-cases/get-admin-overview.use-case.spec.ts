import { GetAdminOverviewUseCase } from './get-admin-overview.use-case';
import type { AdminOverviewRepository } from '../../domain/ports/admin-overview.repository';

describe('GetAdminOverviewUseCase', () => {
  it('returns aggregated overview snapshot', async () => {
    const repository: jest.Mocked<AdminOverviewRepository> = {
      getAggregateCounts: jest.fn().mockResolvedValue({
        inboundMessages: 10,
        outboundMessages: 8,
        outboxFailed: 2,
        webhookFailed: 1,
        activeConversations: 3,
        reminderDispatches: [{ status: 'FAILED', count: 2 }],
        surveyDispatches: [{ status: 'COMPLETED', count: 6 }],
      }),
      getRecentLiveFeed: jest.fn(),
    };

    const useCase = new GetAdminOverviewUseCase(repository, {
      getLookbackHours: () => 24,
    } as never);

    const snapshot = await useCase.execute();
    expect(snapshot.lookbackHours).toBe(24);
    expect(snapshot.inboundMessages).toBe(10);
    expect(snapshot.outboxFailed).toBe(2);
    expect(snapshot.reminderDispatches).toHaveLength(1);
  });
});
