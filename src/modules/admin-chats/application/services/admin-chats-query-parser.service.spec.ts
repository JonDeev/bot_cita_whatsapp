import { ZodError } from 'zod';
import { AdminChatsQueryParserService } from './admin-chats-query-parser.service';

describe('AdminChatsQueryParserService', () => {
  const service = new AdminChatsQueryParserService();

  it('parses list query with defaults', () => {
    const parsed = service.parseListChatsQuery({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.status).toBeNull();
  });

  it('rejects invalid pagination constraints', () => {
    expect(() =>
      service.parseListChatsQuery({ page: 0, pageSize: 1000 }),
    ).toThrow(ZodError);
  });
});
