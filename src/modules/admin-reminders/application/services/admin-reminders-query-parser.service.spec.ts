import { BadRequestException } from '@nestjs/common';
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

import { AdminRemindersQueryParserService } from './admin-reminders-query-parser.service';

describe('AdminRemindersQueryParserService', () => {
  const service = new AdminRemindersQueryParserService();

  it('parses dispatch query with defaults', () => {
    const parsed = service.parseListDispatchesQuery({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.status).toBeNull();
    expect(parsed.fromIso).toBeNull();
    expect(parsed.toIso).toBeNull();
  });

  it('parses dispatch query with from/to filters', () => {
    const parsed = service.parseListDispatchesQuery({
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-02T23:59:59.999Z',
      status: 'FAILED',
    });
    expect(parsed.fromIso).toBe('2026-05-01T00:00:00.000Z');
    expect(parsed.toIso).toBe('2026-05-02T23:59:59.999Z');
    expect(parsed.status).toBe('FAILED');
  });

  it('parses metrics lookback hours when present', () => {
    expect(service.parseMetricsLookbackHours('24')).toBe(24);
    expect(service.parseMetricsLookbackHours(undefined)).toBeUndefined();
  });

  it('rejects invalid lookback hours', () => {
    expect(() => service.parseMetricsLookbackHours('0')).toThrow(
      BadRequestException,
    );
    expect(() => service.parseMetricsLookbackHours('999')).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid dispatch datetime filters', () => {
    expect(() =>
      service.parseListDispatchesQuery({ from: '2026-05-01 10:00:00' }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.parseListDispatchesQuery({ to: 'invalid-date' }),
    ).toThrow(BadRequestException);
  });

  it('parses reminder runtime settings update requests', () => {
    const parsed = service.parseReminderRuntimeSettingsUpdateRequest({
      expectedVersion: 4,
      reason: 'ajuste operativo',
      changes: {
        sendMode: 'live',
        sendRolloutPercent: '75',
      },
    });

    expect(parsed).toEqual({
      expectedVersion: 4,
      reason: 'ajuste operativo',
      changes: {
        sendMode: 'live',
        sendRolloutPercent: '75',
      },
    });
  });

  it('parses emergency pause public payload and history query', () => {
    expect(
      service.parseEmergencyPauseRequest({
        expectedVersion: 7,
        reason: 'incidente',
        enabled: true,
      }),
    ).toEqual({
      expectedVersion: 7,
      reason: 'incidente',
      enabled: true,
    });

    expect(
      service.parseReminderSettingsHistoryQuery({
        page: '2',
        pageSize: '10',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
    });
  });

  it('rejects invalid settings update and emergency pause payloads', () => {
    expect(() =>
      service.parseReminderRuntimeSettingsUpdateRequest({
        expectedVersion: 0,
        changes: {},
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.parseEmergencyPauseRequest({
        expectedVersion: 1,
        reason: '',
        enabled: 'yes',
      }),
    ).toThrow(BadRequestException);
  });
});
