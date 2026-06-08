import { z } from 'zod';

jest.mock('@whatsapp-bot/shared', () => {
  const schema = z
    .object({
      expectedVersion: z.coerce.number().int().positive(),
      reason: z.string().trim().min(1).max(500).optional(),
      changes: z
        .record(z.unknown())
        .refine((value) => Object.keys(value).length > 0, {
          message: 'At least one settings change is required.',
        }),
    })
    .strict();

  return {
    ReminderRuntimeSettingsUpdateRequestSchema: schema,
  };
});

import { AdminRemindersController } from './admin-reminders.controller';

describe('AdminRemindersController', () => {
  function buildController() {
    const getMetrics = { execute: jest.fn() };
    const listDispatches = { execute: jest.fn() };
    const getRuntimeSettings = { execute: jest.fn() };
    const getRuntimeOptions = { execute: jest.fn() };
    const listRuntimeHistory = { execute: jest.fn() };
    const updateRuntimeSettings = { execute: jest.fn() };
    const toggleEmergencyPause = { execute: jest.fn() };
    const parser = {
      parseMetricsLookbackHours: jest.fn(),
      parseListDispatchesQuery: jest.fn(),
      parseReminderSettingsHistoryQuery: jest.fn(),
      parseReminderRuntimeSettingsUpdateRequest: jest.fn(),
      parseEmergencyPauseRequest: jest.fn(),
    };

    const controller = new AdminRemindersController(
      getMetrics as never,
      listDispatches as never,
      getRuntimeSettings as never,
      getRuntimeOptions as never,
      listRuntimeHistory as never,
      updateRuntimeSettings as never,
      toggleEmergencyPause as never,
      parser as never,
    );

    return {
      controller,
      getMetrics,
      listDispatches,
      getRuntimeSettings,
      getRuntimeOptions,
      listRuntimeHistory,
      updateRuntimeSettings,
      toggleEmergencyPause,
      parser,
    };
  }

  it('delegates runtime settings reads and mutations through parser/use cases', async () => {
    const fixture = buildController();
    const adminAuth = {
      user: {
        id: 12,
        role: 'ADMIN',
      },
    };

    fixture.parser.parseReminderSettingsHistoryQuery.mockReturnValue({
      page: 2,
      pageSize: 10,
    });
    fixture.parser.parseReminderRuntimeSettingsUpdateRequest.mockReturnValue({
      expectedVersion: 4,
      changes: {
        sendMode: 'live',
      },
    });
    fixture.parser.parseEmergencyPauseRequest.mockReturnValue({
      expectedVersion: 5,
      reason: 'incidente',
      enabled: true,
    });

    await fixture.controller.getReminderRuntimeSettings(adminAuth as never);
    await fixture.controller.getReminderRuntimeOptions(adminAuth as never);
    await fixture.controller.listReminderRuntimeHistory(
      adminAuth as never,
      { page: '2', pageSize: '10' },
    );
    await fixture.controller.updateReminderRuntimeSettings(
      adminAuth as never,
      {} as never,
      { expectedVersion: 4, changes: { sendMode: 'live' } },
    );
    await fixture.controller.toggleReminderEmergencyPause(
      adminAuth as never,
      {} as never,
      { expectedVersion: 5, reason: 'incidente', enabled: true },
    );

    expect(fixture.getRuntimeSettings.execute).toHaveBeenCalledWith(12, 'ADMIN');
    expect(fixture.getRuntimeOptions.execute).toHaveBeenCalledWith(12);
    expect(fixture.listRuntimeHistory.execute).toHaveBeenCalledWith(
      12,
      'ADMIN',
      { page: 2, pageSize: 10 },
    );
    expect(fixture.updateRuntimeSettings.execute).toHaveBeenCalledWith({
      adminUserId: 12,
      adminRole: 'ADMIN',
      ipHash: null,
      request: {
        expectedVersion: 4,
        changes: {
          sendMode: 'live',
        },
      },
    });
    expect(fixture.toggleEmergencyPause.execute).toHaveBeenCalledWith({
      adminUserId: 12,
      adminRole: 'ADMIN',
      ipHash: null,
      expectedVersion: 5,
      reason: 'incidente',
      enabled: true,
    });
  });
});
