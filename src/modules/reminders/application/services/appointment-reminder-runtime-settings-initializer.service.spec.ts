import {
  APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../domain/appointment-reminder-runtime.types';
import { AppointmentReminderRuntimeSettingsInitializerService } from './appointment-reminder-runtime-settings-initializer.service';

describe('AppointmentReminderRuntimeSettingsInitializerService', () => {
  const bootstrapSnapshot = {
    sendMode: 'mock' as const,
    sendRolloutPercent: 25 as const,
    emergencyPauseEnabled: false,
    dispatchBatchSize: 25 as const,
    eligibilityLimit: 250 as const,
    syncEnabled: false,
    dispatchEnabled: false,
    queueEnabled: true,
    syncIntervalMs: 300_000 as const,
    recoverySweepIntervalMs: 300_000 as const,
    workerConcurrency: 1 as const,
    lockTtlSeconds: 300 as const,
    lockHeartbeatIntervalMs: 60_000 as const,
    minConfirmationHours: 3 as const,
  };

  function buildService(input?: {
    existingRecord?: object | null;
    saveResult?: object | null;
  }) {
    const repository = {
      findByScope: jest.fn().mockResolvedValue(input?.existingRecord ?? null),
      saveWithEvent: jest.fn().mockResolvedValue(input?.saveResult ?? null),
    };

    const bootstrap = {
      getRuntimeSettingsSnapshot: jest.fn().mockReturnValue(bootstrapSnapshot),
    };

    const service = new AppointmentReminderRuntimeSettingsInitializerService(
      repository as never,
      bootstrap as never,
    );

    return { service, repository, bootstrap };
  }

  it('seeds the first persisted runtime snapshot when the database is empty', async () => {
    const { service, repository, bootstrap } = buildService({
      saveResult: {
        settings: {
          id: 1,
          scopeKey: 'default',
          version: 1,
        },
      },
    });

    await service.onModuleInit();

    expect(repository.findByScope).toHaveBeenCalledWith(
      APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
    );
    expect(bootstrap.getRuntimeSettingsSnapshot).toHaveBeenCalled();
    expect(repository.saveWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        expectedVersion: 0,
        nextSnapshot: bootstrapSnapshot,
        effectiveSnapshot: bootstrapSnapshot,
        adminUserId: null,
        changeType:
          APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
        section: 'protected',
        reason: 'bootstrap',
        adminAudit: expect.objectContaining({
          action: 'system.reminder_runtime_settings.defaults_seeded',
          resourceType: 'appointment_reminder_runtime_settings',
          resourceId: 'default',
        }),
      }),
    );
  });

  it('does not reseed when persisted runtime settings already exist', async () => {
    const { service, repository, bootstrap } = buildService({
      existingRecord: { id: 1, scopeKey: 'default', version: 3 },
    });

    await service.onModuleInit();

    expect(bootstrap.getRuntimeSettingsSnapshot).not.toHaveBeenCalled();
    expect(repository.saveWithEvent).not.toHaveBeenCalled();
  });
});
