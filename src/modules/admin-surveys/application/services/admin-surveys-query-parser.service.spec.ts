import { ZodError } from 'zod';
import { AdminSurveysQueryParserService } from './admin-surveys-query-parser.service';

describe('AdminSurveysQueryParserService', () => {
  const service = new AdminSurveysQueryParserService();

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
      status: 'COMPLETED',
    });
    expect(parsed.fromIso).toBe('2026-05-01T00:00:00.000Z');
    expect(parsed.toIso).toBe('2026-05-02T23:59:59.999Z');
    expect(parsed.status).toBe('COMPLETED');
  });

  it('rejects invalid pagination', () => {
    expect(() =>
      service.parseListDispatchesQuery({ page: 0, pageSize: 20 }),
    ).toThrow(ZodError);
  });

  it('rejects invalid dispatch datetime filters', () => {
    expect(() => service.parseListDispatchesQuery({ from: '2026-05-01 10:00:00' })).toThrow(
      ZodError,
    );
    expect(() => service.parseListDispatchesQuery({ to: 'invalid-date' })).toThrow(ZodError);
  });
});
