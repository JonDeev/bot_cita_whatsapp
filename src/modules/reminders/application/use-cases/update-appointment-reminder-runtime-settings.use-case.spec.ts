import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AppointmentReminderRuntimeSettingsCatalogService } from '../services/appointment-reminder-runtime-settings-catalog.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { UpdateAppointmentReminderRuntimeSettingsUseCase } from './update-appointment-reminder-runtime-settings.use-case';

describe('UpdateAppointmentReminderRuntimeSettingsUseCase', () => {
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
            sendRolloutPercent: 75,
          },
          updatedByAdminUserId: 9,
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
          sendRolloutPercent: '75',
          emergencyPauseEnabled: 'disabled',
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
          sendRolloutPercent: '75',
          emergencyPauseEnabled: 'disabled',
          dispatchBatchSize: '50',
          eligibilityLimit: '500',
          lockTtlSeconds: '300',
          lockHeartbeatIntervalMs: '60000',
          minConfirmationHours: '3',
        },
        metadata: {
          version: 2,
          lastUpdatedAtIso: '2026-06-07T12:00:00.000Z',
          lastUpdatedByAdminUserId: 9,
          emergencyPauseReason: null,
        },
        runtimeApplication: {
          restartScopedFieldKeys: [
            'syncEnabled',
            'dispatchEnabled',
            'queueEnabled',
            'syncIntervalMs',
            'recoverySweepIntervalMs',
            'workerConcurrency',
          ],
          restartScopedApplyNote: 'note',
        },
      }),
    } as unknown as AppointmentReminderRuntimeSettingsResolverService;

    return {
      repository,
      useCase: new UpdateAppointmentReminderRuntimeSettingsUseCase(
        repository as never,
        new AppointmentReminderRuntimeSettingsCatalogService(),
        resolver,
      ),
    };
  }

  it('allows supervisors to update primary fields', async () => {
    const { useCase, repository } = buildUseCase();

    const result = await useCase.execute({
      adminUserId: 9,
      adminRole: 'SUPERVISOR',
      request: {
        expectedVersion: 1,
        changes: {
          sendRolloutPercent: '75',
        },
      },
    });

    expect(repository.saveWithEvent).toHaveBeenCalled();
    expect(result.permissions.canEditPrimary).toBe(true);
  });

  it('rejects supervisor updates to protected fields', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        adminUserId: 9,
        adminRole: 'SUPERVISOR',
        request: {
          expectedVersion: 1,
          reason: 'need change',
          changes: {
            lockTtlSeconds: '600',
          },
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects stale version conflicts', async () => {
    const { useCase, repository } = buildUseCase();
    repository.saveWithEvent.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        adminUserId: 9,
        adminRole: 'ADMIN',
        request: {
          expectedVersion: 1,
          changes: {
            sendRolloutPercent: '75',
          },
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
