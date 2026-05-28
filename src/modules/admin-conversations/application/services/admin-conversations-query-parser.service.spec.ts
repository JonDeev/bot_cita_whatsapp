import { ZodError } from 'zod';
import { AdminConversationsQueryParserService } from './admin-conversations-query-parser.service';

describe('AdminConversationsQueryParserService', () => {
  const service = new AdminConversationsQueryParserService();

  it('parses list query with defaults', () => {
    const parsed = service.parseListConversationsQuery({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.status).toBeNull();
  });

  it('rejects invalid pagination constraints', () => {
    expect(() =>
      service.parseListConversationsQuery({ page: 0, pageSize: 1000 }),
    ).toThrow(ZodError);
  });
});
