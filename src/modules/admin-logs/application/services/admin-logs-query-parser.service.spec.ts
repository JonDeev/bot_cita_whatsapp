import { ZodError } from 'zod';
import { AdminLogsQueryParserService } from './admin-logs-query-parser.service';

describe('AdminLogsQueryParserService', () => {
  const service = new AdminLogsQueryParserService();

  it('parses defaults for events query', () => {
    const parsed = service.parseEventsQuery({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.action).toBeNull();
    expect(parsed.fromIso).toBeNull();
    expect(parsed.toIso).toBeNull();
  });

  it('parses datetime range filters', () => {
    const parsed = service.parseEventsQuery({
      from: '2026-05-26T00:00:00.000Z',
      to: '2026-05-27T00:00:00.000Z',
    });

    expect(parsed.fromIso).toBe('2026-05-26T00:00:00.000Z');
    expect(parsed.toIso).toBe('2026-05-27T00:00:00.000Z');
  });

  it('rejects invalid failure source', () => {
    expect(() => service.parseFailuresQuery({ source: 'OTHER' })).toThrow(
      ZodError,
    );
  });

  it('rejects invalid datetime filter', () => {
    expect(() => service.parseAuditQuery({ from: 'invalid-date' })).toThrow(
      ZodError,
    );
  });
});
