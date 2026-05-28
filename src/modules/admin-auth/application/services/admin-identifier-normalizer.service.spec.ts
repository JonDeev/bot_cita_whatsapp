import { ZodError } from 'zod';
import { AdminIdentifierNormalizerService } from './admin-identifier-normalizer.service';

describe('AdminIdentifierNormalizerService', () => {
  const service = new AdminIdentifierNormalizerService();

  it('normalizes identifier as trim + lowercase', () => {
    expect(service.normalizeIdentifier('  ADMIN@SISM.COM.CO ')).toBe(
      'admin@sism.com.co',
    );
  });

  it('accepts valid username', () => {
    expect(service.normalizeUsername('  Admin_User-01 ')).toBe('admin_user-01');
  });

  it('rejects invalid username format', () => {
    expect(() => service.normalizeUsername('ab')).toThrow(ZodError);
    expect(() => service.normalizeUsername('admin with spaces')).toThrow(
      ZodError,
    );
    expect(() => service.normalizeUsername('admin@foo')).toThrow(ZodError);
  });
});
