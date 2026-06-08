import { AppointmentReminderRuntimeSettingsCatalogService } from './appointment-reminder-runtime-settings-catalog.service';

describe('AppointmentReminderRuntimeSettingsCatalogService', () => {
  let service: AppointmentReminderRuntimeSettingsCatalogService;

  beforeEach(() => {
    service = new AppointmentReminderRuntimeSettingsCatalogService();
  });

  it('returns sectioned options with stable ordering and role restrictions', () => {
    const options = service.getOptions();

    expect(options.sections.primary.map((field) => field.key)).toEqual([
      'sendMode',
      'sendRolloutPercent',
      'emergencyPauseEnabled',
    ]);
    expect(options.sections.advanced.map((field) => field.key)).toEqual([
      'dispatchBatchSize',
      'eligibilityLimit',
    ]);
    expect(options.sections.protected[0]).toMatchObject({
      key: 'syncEnabled',
      applyMode: 'restart_required',
      editableByRoles: ['ADMIN'],
      requiresReason: true,
    });
  });

  it('converts dto snapshots to domain-native runtime values', () => {
    const snapshot = service.toDomainSnapshot({
      sendMode: 'live',
      sendRolloutPercent: '75',
      emergencyPauseEnabled: 'enabled',
      dispatchBatchSize: '50',
      eligibilityLimit: '500',
      syncEnabled: 'disabled',
      dispatchEnabled: 'enabled',
      queueEnabled: 'disabled',
      syncIntervalMs: '300000',
      recoverySweepIntervalMs: '600000',
      workerConcurrency: '3',
      lockTtlSeconds: '180',
      lockHeartbeatIntervalMs: '30000',
      minConfirmationHours: '6',
    });

    expect(snapshot).toEqual({
      sendMode: 'live',
      sendRolloutPercent: 75,
      emergencyPauseEnabled: true,
      dispatchBatchSize: 50,
      eligibilityLimit: 500,
      syncEnabled: false,
      dispatchEnabled: true,
      queueEnabled: false,
      syncIntervalMs: 300_000,
      recoverySweepIntervalMs: 600_000,
      workerConcurrency: 3,
      lockTtlSeconds: 180,
      lockHeartbeatIntervalMs: 30_000,
      minConfirmationHours: 6,
    });
  });

  it('round-trips domain snapshots back to dto values', () => {
    const dto = service.toDtoSnapshot({
      sendMode: 'mock',
      sendRolloutPercent: 25,
      emergencyPauseEnabled: false,
      dispatchBatchSize: 25,
      eligibilityLimit: 250,
      syncEnabled: true,
      dispatchEnabled: false,
      queueEnabled: true,
      syncIntervalMs: 60_000,
      recoverySweepIntervalMs: 900_000,
      workerConcurrency: 2,
      lockTtlSeconds: 300,
      lockHeartbeatIntervalMs: 60_000,
      minConfirmationHours: 12,
    });

    expect(dto).toEqual({
      sendMode: 'mock',
      sendRolloutPercent: '25',
      emergencyPauseEnabled: 'disabled',
      dispatchBatchSize: '25',
      eligibilityLimit: '250',
      syncEnabled: 'enabled',
      dispatchEnabled: 'disabled',
      queueEnabled: 'enabled',
      syncIntervalMs: '60000',
      recoverySweepIntervalMs: '900000',
      workerConcurrency: '2',
      lockTtlSeconds: '300',
      lockHeartbeatIntervalMs: '60000',
      minConfirmationHours: '12',
    });
  });

  it('exposes hot-reloadable and restart-scoped keys without overlap drift', () => {
    expect(service.getHotReloadableFieldKeys()).toEqual([
      'sendMode',
      'sendRolloutPercent',
      'emergencyPauseEnabled',
      'dispatchBatchSize',
      'eligibilityLimit',
      'lockTtlSeconds',
      'lockHeartbeatIntervalMs',
      'minConfirmationHours',
    ]);
    expect(service.getRestartScopedFieldKeys()).toEqual([
      'syncEnabled',
      'dispatchEnabled',
      'queueEnabled',
      'syncIntervalMs',
      'recoverySweepIntervalMs',
      'workerConcurrency',
    ]);
  });
});
