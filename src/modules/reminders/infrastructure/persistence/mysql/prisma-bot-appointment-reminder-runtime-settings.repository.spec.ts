import type { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { Prisma } from '@whatsapp-bot/prisma-client';
import {
  APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../../domain/appointment-reminder-runtime.types';
import { PrismaBotAppointmentReminderRuntimeSettingsRepository } from './prisma-bot-appointment-reminder-runtime-settings.repository';

type FindUniqueInput = Parameters<
  PrismaBotService['botAppointmentReminderRuntimeSettings']['findUnique']
>[0];
type CreateSettingsInput = Parameters<
  PrismaBotService['botAppointmentReminderRuntimeSettings']['create']
>[0];
type UpdateManySettingsInput = Parameters<
  PrismaBotService['botAppointmentReminderRuntimeSettings']['updateMany']
>[0];
type CreateEventInput = Parameters<
  PrismaBotService['botAppointmentReminderRuntimeSettingEvent']['create']
>[0];
type CreateAdminAuditInput = Parameters<
  PrismaBotService['botAdminAuditEvent']['create']
>[0];

describe('PrismaBotAppointmentReminderRuntimeSettingsRepository', () => {
  const baseSnapshot = {
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

  it('creates the default snapshot and appends the first canonical event', async () => {
    const findUnique = jest
      .fn<Promise<unknown>, [FindUniqueInput]>()
      .mockResolvedValueOnce(null);
    const createSettings = jest
      .fn<Promise<unknown>, [CreateSettingsInput]>()
      .mockResolvedValue({
        id: 1,
        scopeKey: 'default',
        ...baseSnapshot,
        version: 1,
        updatedByAdminUserId: 7,
        updatedAt: new Date('2026-06-07T12:00:00.000Z'),
        createdAt: new Date('2026-06-07T12:00:00.000Z'),
      });
    const createEvent = jest
      .fn<Promise<unknown>, [CreateEventInput]>()
      .mockResolvedValue({
        id: 11,
        settingsVersion: 1,
        adminUserId: 7,
        changeType:
          APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
        section: 'protected',
        reason: 'bootstrap',
        previousSnapshotJson: baseSnapshot,
        newSnapshotJson: baseSnapshot,
        effectiveSnapshotJson: baseSnapshot,
        occurredAt: new Date('2026-06-07T12:00:00.000Z'),
        createdAt: new Date('2026-06-07T12:00:00.000Z'),
      });
    const createAdminAudit = jest
      .fn<Promise<unknown>, [CreateAdminAuditInput]>()
      .mockResolvedValue(undefined);

    const tx = {
      botAppointmentReminderRuntimeSettings: {
        findUnique,
        createSettings,
        create: createSettings,
      },
      botAppointmentReminderRuntimeSettingEvent: {
        create: createEvent,
      },
      botAdminAuditEvent: {
        create: createAdminAudit,
      },
    };

    const prismaBot = {
      $transaction: jest.fn(async (callback: (input: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 0,
      nextSnapshot: baseSnapshot,
      effectiveSnapshot: baseSnapshot,
      adminUserId: 7,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
      section: 'protected',
      reason: 'bootstrap',
      occurredAtIso: '2026-06-07T12:00:00.000Z',
      adminAudit: {
        action: 'admin.reminder_runtime_settings.seeded',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: 'default',
        metadata: { section: 'protected' },
        ipHash: null,
      },
    });

    expect(findUnique.mock.calls[0]?.[0]).toEqual({
      where: { scopeKey: 'default' },
    });
    expect(createSettings.mock.calls[0]?.[0]).toMatchObject({
      data: {
        scopeKey: 'default',
        version: 1,
        updatedByAdminUserId: 7,
      },
    });
    expect(createEvent.mock.calls[0]?.[0]).toMatchObject({
      data: {
        settingsVersion: 1,
        adminUserId: 7,
        section: 'protected',
        reason: 'bootstrap',
      },
    });
    expect(createAdminAudit.mock.calls[0]?.[0]).toMatchObject({
      data: {
        adminUserId: 7,
        action: 'admin.reminder_runtime_settings.seeded',
      },
    });
    expect(result).toMatchObject({
      settings: {
        scopeKey: 'default',
        version: 1,
      },
      event: {
        settingsVersion: 1,
        adminUserId: 7,
      },
    });
  });

  it('updates an existing snapshot with optimistic versioning and records history', async () => {
    const existing = {
      id: 1,
      scopeKey: 'default',
      ...baseSnapshot,
      version: 3,
      updatedByAdminUserId: 5,
      updatedAt: new Date('2026-06-07T11:00:00.000Z'),
      createdAt: new Date('2026-06-07T10:00:00.000Z'),
    };
    const updated = {
      ...existing,
      emergencyPauseEnabled: true,
      version: 4,
      updatedByAdminUserId: 9,
      updatedAt: new Date('2026-06-07T12:00:00.000Z'),
    };

    const findUnique = jest
      .fn<Promise<unknown>, [FindUniqueInput]>()
      .mockResolvedValueOnce(existing);
    const updateMany = jest
      .fn<Promise<unknown>, [UpdateManySettingsInput]>()
      .mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue(updated);
    const createEvent = jest
      .fn<Promise<unknown>, [CreateEventInput]>()
      .mockResolvedValue({
        id: 12,
        settingsVersion: 4,
        adminUserId: 9,
        changeType:
          APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
        section: 'primary',
        reason: 'incident review',
        previousSnapshotJson: baseSnapshot,
        newSnapshotJson: {
          ...baseSnapshot,
          emergencyPauseEnabled: true,
        },
        effectiveSnapshotJson: {
          ...baseSnapshot,
          emergencyPauseEnabled: true,
        },
        occurredAt: new Date('2026-06-07T12:00:00.000Z'),
        createdAt: new Date('2026-06-07T12:00:00.000Z'),
      });
    const createAdminAudit = jest
      .fn<Promise<unknown>, [CreateAdminAuditInput]>()
      .mockResolvedValue(undefined);

    const tx = {
      botAppointmentReminderRuntimeSettings: {
        findUnique,
        updateMany,
        findUniqueOrThrow,
      },
      botAppointmentReminderRuntimeSettingEvent: {
        create: createEvent,
      },
      botAdminAuditEvent: {
        create: createAdminAudit,
      },
    };

    const prismaBot = {
      $transaction: jest.fn(async (callback: (input: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 3,
      nextSnapshot: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      effectiveSnapshot: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      adminUserId: 9,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
      section: 'primary',
      reason: 'incident review',
      occurredAtIso: '2026-06-07T12:00:00.000Z',
      adminAudit: {
        action: 'admin.reminder_runtime_settings.emergency_pause_enabled',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: 'default',
        metadata: { section: 'primary' },
        ipHash: null,
      },
    });

    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: 1,
        version: 3,
      },
      data: {
        emergencyPauseEnabled: true,
        updatedByAdminUserId: 9,
        version: {
          increment: 1,
        },
      },
    });
    expect(createEvent.mock.calls[0]?.[0]).toMatchObject({
      data: {
        settingsVersion: 4,
        adminUserId: 9,
        changeType: 'EMERGENCY_PAUSE_ENABLED',
        section: 'primary',
        reason: 'incident review',
      },
    });
    expect(createAdminAudit.mock.calls[0]?.[0]).toMatchObject({
      data: {
        adminUserId: 9,
        action: 'admin.reminder_runtime_settings.emergency_pause_enabled',
      },
    });
    expect(result).toMatchObject({
      settings: {
        version: 4,
        updatedByAdminUserId: 9,
      },
      event: {
        settingsVersion: 4,
        reason: 'incident review',
      },
    });
  });

  it('returns null on stale version conflicts without creating history events', async () => {
    const findUnique = jest
      .fn<Promise<unknown>, [FindUniqueInput]>()
      .mockResolvedValueOnce({
        id: 1,
        scopeKey: 'default',
        ...baseSnapshot,
        version: 4,
        updatedByAdminUserId: 5,
        updatedAt: new Date('2026-06-07T11:00:00.000Z'),
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
      });
    const updateMany = jest
      .fn<Promise<unknown>, [UpdateManySettingsInput]>()
      .mockResolvedValue({ count: 0 });
    const createEvent = jest.fn();
    const createAdminAudit = jest.fn();

    const tx = {
      botAppointmentReminderRuntimeSettings: {
        findUnique,
        updateMany,
      },
      botAppointmentReminderRuntimeSettingEvent: {
        create: createEvent,
      },
      botAdminAuditEvent: {
        create: createAdminAudit,
      },
    };

    const prismaBot = {
      $transaction: jest.fn(async (callback: (input: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 3,
      nextSnapshot: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      effectiveSnapshot: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      adminUserId: 9,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.SETTINGS_UPDATED,
      section: 'primary',
      reason: null,
      occurredAtIso: '2026-06-07T12:00:00.000Z',
      adminAudit: {
        action: 'admin.reminder_runtime_settings.updated',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: 'default',
        metadata: {},
        ipHash: null,
      },
    });

    expect(result).toBeNull();
    expect(createEvent).not.toHaveBeenCalled();
    expect(createAdminAudit).not.toHaveBeenCalled();
  });

  it('lists canonical events in reverse chronological order', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 12,
        settingsVersion: 4,
        adminUserId: 9,
        changeType: 'EMERGENCY_PAUSE_ENABLED',
        section: 'primary',
        reason: 'incident review',
        previousSnapshotJson: baseSnapshot,
        newSnapshotJson: {
          ...baseSnapshot,
          emergencyPauseEnabled: true,
        },
        effectiveSnapshotJson: {
          ...baseSnapshot,
          emergencyPauseEnabled: true,
        },
        occurredAt: new Date('2026-06-07T12:00:00.000Z'),
        createdAt: new Date('2026-06-07T12:00:00.000Z'),
      },
    ]);

    const prismaBot = {
      botAppointmentReminderRuntimeSettingEvent: {
        findMany,
      },
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.listEvents({ limit: 10 });

    expect(findMany.mock.calls[0]?.[0]).toEqual({
      include: {
        adminUser: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
    expect(result[0]).toMatchObject({
      settingsVersion: 4,
      section: 'primary',
      reason: 'incident review',
    });
  });

  it('finds the latest pause transition event without relying on an arbitrary window', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 42,
      settingsVersion: 7,
      adminUserId: 10,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
      section: 'primary',
      reason: 'incident review',
      previousSnapshotJson: baseSnapshot,
      newSnapshotJson: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      effectiveSnapshotJson: {
        ...baseSnapshot,
        emergencyPauseEnabled: true,
      },
      occurredAt: new Date('2026-06-07T13:00:00.000Z'),
      createdAt: new Date('2026-06-07T13:00:00.000Z'),
      adminUser: {
        displayName: 'Admin SISM',
        username: 'admin',
      },
    });

    const prismaBot = {
      botAppointmentReminderRuntimeSettingEvent: {
        findFirst,
      },
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.findLatestEventByChangeTypes({
      changeTypes: [
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
      ],
    });

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        changeType: {
          in: [
            APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
            APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_DISABLED,
          ],
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toMatchObject({
      id: 42,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.EMERGENCY_PAUSE_ENABLED,
      reason: 'incident review',
      actor: {
        displayName: 'Admin SISM',
        username: 'admin',
      },
    });
  });

  it('treats a concurrent first-create unique collision as already initialized', async () => {
    const findUnique = jest
      .fn<Promise<unknown>, [FindUniqueInput]>()
      .mockResolvedValueOnce(null);
    const createSettings = jest
      .fn<Promise<never>, [CreateSettingsInput]>()
      .mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Duplicate scope key', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );
    const createEvent = jest.fn<Promise<unknown>, [CreateEventInput]>();
    const createAdminAudit = jest.fn<Promise<unknown>, [CreateAdminAuditInput]>();

    const tx = {
      botAppointmentReminderRuntimeSettings: {
        findUnique,
        create: createSettings,
      },
      botAppointmentReminderRuntimeSettingEvent: {
        create: createEvent,
      },
      botAdminAuditEvent: {
        create: createAdminAudit,
      },
    };

    const prismaBot = {
      $transaction: jest.fn(async (callback: (input: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaBotService;

    const repository =
      new PrismaBotAppointmentReminderRuntimeSettingsRepository(prismaBot);

    const result = await repository.saveWithEvent({
      scopeKey: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: 0,
      nextSnapshot: baseSnapshot,
      effectiveSnapshot: baseSnapshot,
      adminUserId: null,
      changeType:
        APPOINTMENT_REMINDER_RUNTIME_SETTING_CHANGE_TYPES.DEFAULTS_SEEDED,
      section: 'protected',
      reason: 'bootstrap',
      occurredAtIso: '2026-06-07T12:00:00.000Z',
      adminAudit: {
        action: 'system.reminder_runtime_settings.defaults_seeded',
        resourceType: 'appointment_reminder_runtime_settings',
        resourceId: 'default',
        metadata: { source: 'bootstrap' },
        ipHash: null,
      },
    });

    expect(result).toBeNull();
    expect(createEvent).not.toHaveBeenCalled();
    expect(createAdminAudit).not.toHaveBeenCalled();
  });
});
