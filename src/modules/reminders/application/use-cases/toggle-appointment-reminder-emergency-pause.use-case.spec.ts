import { ConflictException } from '@nestjs/common';
import { ToggleAppointmentReminderEmergencyPauseUseCase } from './toggle-appointment-reminder-emergency-pause.use-case';

describe('ToggleAppointmentReminderEmergencyPauseUseCase', () => {
  const currentSnapshot = {
    sendMode: 'live' as const,
    sendRolloutPercent: 100 as const,
    emergencyPauseEnabled: false,
    dispatchBatchSize: 50 as const,
    eligibilityLimit: 500 as const,
    syncEnabled: true,
    dispatchEnabled: true,
    queueEnabled: true,
    syncIntervalMs: 300_000 as const,
    recoverySweepIntervalMs: 300_000 as const,
    workerConcurrency: 1 as const,
    lockTtlSeconds: 300 as const,
    lockHeartbeatIntervalMs: 60_000 as const,
    minConfirmationHours: 3 as const,
  };

  function buildUseCase() {
    const repository = {
      saveWithEvent: jest.fn().mockResolvedValue({
        settings: {
          id: 1,
          scopeKey: 'default',
          version: 2,
          snapshot: {
            ...currentSnapshot,
            emergencyPauseEnabled: true,
          },
          updatedByAdminUserId: 8,
          updatedAtIso: '2026-06-07T12:00:00.000Z',
          createdAtIso: '2026-06-07T11:00:00.000Z',
        },
      }),
    };
    const resolver = {
      getStoredRecord: jest.fn().mockResolvedValue({
        id: 1,
        scopeKey: 'default',
        version: 1,
        snapshot: currentSnapshot,
        updatedByAdminUserId: 7,
        updatedAtIso: '2026-06-07T11:00:00.000Z',
        createdAtIso: '2026-06-07T11:00:00.000Z',
      }),
      resolveStoredSnapshot: jest.fn().mockResolvedValue(currentSnapshot),
      resolveRuntimeView: jest.fn().mockResolvedValue({
        stored: {
          sendMode: 'live',
          sendRolloutPercent: '100',
          emergencyPauseEnabled: 'enabled',
          dispatchBatchSize: '50',
          eligibilityLimit: '500',
          syncEnabled: 'enabled',
          dispatchEnabled: 'enabled',
          queueEnabled: 'enabled',
          syncIntervalMs: '300000',
          recoverySweepIntervalMs: '300000',
          workerConcurrency: '1',
          lockTtlSeconds: '300',
          lockHeartbeatIntervalMs: '60000',
          minConfirmationHours: '3',
        },
        effectiveHotReloadable: {
          sendMode: 'live',
          sendRolloutPercent: '100',
          emergencyPauseEnabled: 'enabled',
          dispatchBatchSize: '50',
          eligibilityLimit: '500',
          lockTtlSeconds: '300',
          lockHeartbeatIntervalMs: '60000',
          minConfirmationHours: '3',
        },
        metadata: {
          version: 2,
          lastUpdatedAtIso: '2026-06-07T12:00:00.000Z',
          lastUpdatedByAdminUserId: 8,
          emergencyPauseReason: null,
        },
        runtimeApplication: {
          restartScopedFieldKeys: [],
          restartScopedApplyNote: 'note',
        },
      }),
    };

    return {
      repository,
      useCase: new ToggleAppointmentReminderEmergencyPauseUseCase(
        repository as never,
        resolver as never,
      ),
    };
  }

  it('requires atomic save and returns updated settings view', async () => {
    const { useCase, repository } = buildUseCase();

    const result = await useCase.execute({
      adminUserId: 8,
      adminRole: 'SUPERVISOR',
      expectedVersion: 1,
      reason: 'incident response',
      emergencyPauseEnabled: 'enabled',
    });

    expect(repository.saveWithEvent).toHaveBeenCalled();
    expect(result.stored.emergencyPauseEnabled).toBe('enabled');
  });

  it('rejects stale version conflicts', async () => {
    const { useCase, repository } = buildUseCase();
    repository.saveWithEvent.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        adminUserId: 8,
        adminRole: 'ADMIN',
        expectedVersion: 1,
        reason: 'incident response',
        emergencyPauseEnabled: 'enabled',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
