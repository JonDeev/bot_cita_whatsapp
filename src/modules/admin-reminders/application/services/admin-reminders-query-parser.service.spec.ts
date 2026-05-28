import { ZodError } from 'zod';
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
    expect(() => service.parseMetricsLookbackHours('0')).toThrow(ZodError);
    expect(() => service.parseMetricsLookbackHours('999')).toThrow(ZodError);
  });

  it('rejects invalid dispatch datetime filters', () => {
    expect(() => service.parseListDispatchesQuery({ from: '2026-05-01 10:00:00' })).toThrow(
      ZodError,
    );
    expect(() => service.parseListDispatchesQuery({ to: 'invalid-date' })).toThrow(ZodError);
  });
});
