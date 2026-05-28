import { AdminPasswordHasherService } from './admin-password-hasher.service';

describe('AdminPasswordHasherService', () => {
  const service = new AdminPasswordHasherService({
    getDummyPasswordHash: () => null,
    getArgon2MemoryKib: () => 65_536,
    getArgon2Passes: () => 3,
    getArgon2Parallelism: () => 1,
    getArgon2TagLength: () => 32,
  } as never);

  it('hashes and verifies a password', () => {
    const hash = service.hashPassword('secret-value');
    expect(service.verifyPassword(hash, 'secret-value')).toBe(true);
    expect(service.verifyPassword(hash, 'wrong-value')).toBe(false);
  });

  it('returns false for malformed hashes', () => {
    expect(service.verifyPassword('not-a-valid-hash', 'secret-value')).toBe(false);
  });
});
