import { AppointmentReminderBootstrapConfigService } from './appointment-reminder-bootstrap-config.service';
import { AppointmentReminderRuntimeSettingsCatalogService } from './appointment-reminder-runtime-settings-catalog.service';
import { AppointmentReminderRuntimeSettingsResolverService } from './appointment-reminder-runtime-settings-resolver.service';

describe('AppointmentReminderRuntimeSettingsResolverService', () => {
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

function buildResolver(input?: {
  record?: {
    version: number;
    updatedAtIso: string;
    updatedByAdminUserId: number | null;
    snapshot: typeof bootstrapSnapshot;
  } | null;
  latestPauseEvent?: {
    changeType:
      | 'EMERGENCY_PAUSE_ENABLED'
      | 'EMERGENCY_PAUSE_DISABLED'
      | 'SETTINGS_UPDATED'
      | 'DEFAULTS_SEEDED';
    reason: string | null;
  } | null;
}) {
  const repository = {
    findByScope: jest.fn().mockResolvedValue(
      input?.record
        ? {
              id: 1,
              scopeKey: 'default',
              ...input.record,
              createdAtIso: input.record.updatedAtIso,
            }
        : null,
    ),
    findLatestEventByChangeTypes: jest.fn().mockResolvedValue(
      input?.latestPauseEvent
        ? {
            id: 99,
            settingsVersion: 4,
            adminUserId: 7,
            actor: {
              displayName: 'Admin',
              username: 'admin',
            },
            changeType: input.latestPauseEvent.changeType,
            section: 'primary' as const,
            reason: input.latestPauseEvent.reason,
            previousSnapshot: bootstrapSnapshot,
            newSnapshot: {
              ...bootstrapSnapshot,
              emergencyPauseEnabled:
                input.latestPauseEvent.changeType === 'EMERGENCY_PAUSE_ENABLED',
            },
            effectiveSnapshot: {
              ...bootstrapSnapshot,
              emergencyPauseEnabled:
                input.latestPauseEvent.changeType === 'EMERGENCY_PAUSE_ENABLED',
            },
            occurredAtIso: '2026-06-07T12:00:00.000Z',
            createdAtIso: '2026-06-07T12:00:00.000Z',
          }
        : null,
    ),
  };

    const bootstrap = {
      getRuntimeSettingsSnapshot: jest.fn().mockReturnValue(bootstrapSnapshot),
    } as unknown as AppointmentReminderBootstrapConfigService;

    const catalog = new AppointmentReminderRuntimeSettingsCatalogService();

    const resolver = new AppointmentReminderRuntimeSettingsResolverService(
      repository as never,
      bootstrap,
      catalog,
    );

    return { resolver, repository, bootstrap };
  }

  it('falls back to bootstrap settings when no DB snapshot exists', async () => {
    const { resolver, bootstrap } = buildResolver();

    const view = await resolver.resolveRuntimeView();

    expect(bootstrap.getRuntimeSettingsSnapshot).toHaveBeenCalled();
    expect(view.stored.sendMode).toBe('mock');
    expect(view.metadata.version).toBe(0);
  });

  it('uses persisted snapshot for effective hot-reloadable values', async () => {
    const { resolver } = buildResolver({
      record: {
        version: 3,
        updatedAtIso: '2026-06-07T12:00:00.000Z',
        updatedByAdminUserId: 7,
        snapshot: {
          ...bootstrapSnapshot,
          sendMode: 'live',
          sendRolloutPercent: 75,
          dispatchBatchSize: 50,
        },
      },
    });

    const effective = await resolver.resolveEffectiveHotReloadableSettings();

    expect(effective).toMatchObject({
      sendMode: 'live',
      sendRolloutPercent: 75,
      dispatchBatchSize: 50,
    });
  });

  it('keeps emergency pause visible in effective state', async () => {
    const { resolver } = buildResolver({
      record: {
        version: 4,
        updatedAtIso: '2026-06-07T13:00:00.000Z',
        updatedByAdminUserId: 9,
        snapshot: {
          ...bootstrapSnapshot,
          sendMode: 'live',
          emergencyPauseEnabled: true,
        },
      },
    });

    const effective = await resolver.resolveEffectiveHotReloadableSettings();
    const active = await resolver.isEmergencyPauseActive();

    expect(effective).toMatchObject({
      sendMode: 'live',
      emergencyPauseEnabled: true,
    });
    expect(active).toBe(true);
  });

  it('exposes the latest active emergency pause reason in runtime view', async () => {
    const { resolver } = buildResolver({
      record: {
        version: 4,
        updatedAtIso: '2026-06-07T13:00:00.000Z',
        updatedByAdminUserId: 9,
        snapshot: {
          ...bootstrapSnapshot,
          sendMode: 'live',
          emergencyPauseEnabled: true,
        },
      },
      latestPauseEvent: {
        changeType: 'EMERGENCY_PAUSE_ENABLED',
        reason: 'Incidente de WhatsApp Cloud API',
      },
    });

    const view = await resolver.resolveRuntimeView();

    expect(view.metadata.emergencyPauseReason).toBe(
      'Incidente de WhatsApp Cloud API',
    );
  });

  it('hides the pause reason when the latest pause transition is disabled', async () => {
    const { resolver } = buildResolver({
      record: {
        version: 4,
        updatedAtIso: '2026-06-07T13:00:00.000Z',
        updatedByAdminUserId: 9,
        snapshot: {
          ...bootstrapSnapshot,
          sendMode: 'live',
          emergencyPauseEnabled: false,
        },
      },
      latestPauseEvent: {
        changeType: 'EMERGENCY_PAUSE_DISABLED',
        reason: 'Incidente resuelto',
      },
    });

    const view = await resolver.resolveRuntimeView();

    expect(view.metadata.emergencyPauseReason).toBeNull();
  });
});
