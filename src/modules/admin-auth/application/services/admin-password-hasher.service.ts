import { Injectable } from '@nestjs/common';
import { argon2Sync, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AdminAuthConfigService } from './admin-auth-config.service';

const ARGON2_PASSWORD_HASH_PREFIX = 'argon2id$v1';
const SCRYPT_PASSWORD_HASH_PREFIX = 'scrypt$v1';

interface EncodedArgon2HashParts {
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
  salt: Buffer;
  hash: Buffer;
}

interface EncodedScryptHashParts {
  n: number;
  r: number;
  p: number;
  keyLength: number;
  salt: Buffer;
  hash: Buffer;
}

@Injectable()
export class AdminPasswordHasherService {
  private readonly dummyPasswordHash: string;

  constructor(private readonly config: AdminAuthConfigService) {
    const configuredDummyHash = this.config.getDummyPasswordHash();
    if (configuredDummyHash) {
      this.validateConfiguredDummyHash(configuredDummyHash);
      this.dummyPasswordHash = configuredDummyHash;
      return;
    }

    if (this.config.isProductionEnvironment()) {
      throw new Error(
        'Missing ADMIN_AUTH_DUMMY_PASSWORD_HASH in production environment.',
      );
    }

    this.dummyPasswordHash = this.hashPasswordSync('__admin_dummy_password__');
  }

  hashPassword(password: string): string {
    return this.hashPasswordSync(password);
  }

  verifyPassword(candidateHash: string, password: string): boolean {
    const parsedArgon2 = this.parseArgon2Hash(candidateHash);
    if (parsedArgon2) {
      if (typeof argon2Sync !== 'function') {
        return false;
      }

      const recomputed = argon2Sync('argon2id', {
        message: password,
        nonce: parsedArgon2.salt,
        memory: parsedArgon2.memory,
        passes: parsedArgon2.passes,
        parallelism: parsedArgon2.parallelism,
        tagLength: parsedArgon2.tagLength,
      });

      if (recomputed.byteLength !== parsedArgon2.hash.byteLength) {
        return false;
      }

      return timingSafeEqual(recomputed, parsedArgon2.hash);
    }

    const parsedScrypt = this.parseScryptHash(candidateHash);
    if (!parsedScrypt) {
      return false;
    }

    const recomputed = scryptSync(password, parsedScrypt.salt, parsedScrypt.keyLength, {
      N: parsedScrypt.n,
      r: parsedScrypt.r,
      p: parsedScrypt.p,
      maxmem: 64 * 1024 * 1024,
    });

    if (recomputed.byteLength !== parsedScrypt.hash.byteLength) {
      return false;
    }

    return timingSafeEqual(recomputed, parsedScrypt.hash);
  }

  getDummyPasswordHash(): string {
    return this.dummyPasswordHash;
  }

  private validateConfiguredDummyHash(hash: string): void {
    const parsedArgon2 = this.parseArgon2Hash(hash);
    const parsedScrypt = this.parseScryptHash(hash);

    if (!parsedArgon2 && !parsedScrypt) {
      throw new Error(
        'Invalid ADMIN_AUTH_DUMMY_PASSWORD_HASH. Expected argon2id$v1 or scrypt$v1 format.',
      );
    }

    if (this.config.isProductionEnvironment()) {
      if (!parsedArgon2) {
        throw new Error(
          'Invalid ADMIN_AUTH_DUMMY_PASSWORD_HASH for production. Expected argon2id$v1 format.',
        );
      }

      if (typeof argon2Sync !== 'function') {
        throw new Error(
          'Argon2id is not available in this runtime but production requires ADMIN_AUTH_DUMMY_PASSWORD_HASH in argon2id$v1 format.',
        );
      }
    }
  }

  private hashPasswordSync(password: string): string {
    if (typeof argon2Sync === 'function') {
      const memory = this.config.getArgon2MemoryKib();
      const passes = this.config.getArgon2Passes();
      const parallelism = this.config.getArgon2Parallelism();
      const tagLength = this.config.getArgon2TagLength();
      const salt = randomBytes(16);

      const derived = argon2Sync('argon2id', {
        message: password,
        nonce: salt,
        memory,
        passes,
        parallelism,
        tagLength,
      });

      return `${ARGON2_PASSWORD_HASH_PREFIX}$m=${memory},t=${passes},p=${parallelism},l=${tagLength}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
    }

    const keyLength = 32;
    const n = 1 << 15;
    const r = 8;
    const p = 1;
    const salt = randomBytes(16);

    const derived = scryptSync(password, salt, keyLength, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return `${SCRYPT_PASSWORD_HASH_PREFIX}$n=${n},r=${r},p=${p},l=${keyLength}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
  }

  private parseArgon2Hash(value: string): EncodedArgon2HashParts | null {
    const sections = value.split('$');
    if (sections.length !== 5) {
      return null;
    }

    const [algorithm, version, params, saltRaw, hashRaw] = sections;
    if (algorithm !== 'argon2id' || version !== 'v1') {
      return null;
    }

    const parsedParams = this.parseArgon2Params(params);
    if (!parsedParams) {
      return null;
    }

    try {
      const salt = Buffer.from(saltRaw, 'base64url');
      const hash = Buffer.from(hashRaw, 'base64url');

      if (salt.byteLength < 8 || hash.byteLength === 0) {
        return null;
      }

      return {
        ...parsedParams,
        salt,
        hash,
      };
    } catch {
      return null;
    }
  }

  private parseArgon2Params(
    raw: string,
  ): Omit<EncodedArgon2HashParts, 'salt' | 'hash'> | null {
    const parts = raw.split(',');
    if (parts.length !== 4) {
      return null;
    }

    const values = new Map<string, number>();
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (!key || !value) {
        return null;
      }

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
      }

      values.set(key, parsed);
    }

    const memory = values.get('m');
    const passes = values.get('t');
    const parallelism = values.get('p');
    const tagLength = values.get('l');
    if (!memory || !passes || !parallelism || !tagLength) {
      return null;
    }

    return { memory, passes, parallelism, tagLength };
  }

  private parseScryptHash(value: string): EncodedScryptHashParts | null {
    const sections = value.split('$');
    if (sections.length !== 5) {
      return null;
    }

    const [algorithm, version, params, saltRaw, hashRaw] = sections;
    if (algorithm !== 'scrypt' || version !== 'v1') {
      return null;
    }

    const parsedParams = this.parseScryptParams(params);
    if (!parsedParams) {
      return null;
    }

    try {
      const salt = Buffer.from(saltRaw, 'base64url');
      const hash = Buffer.from(hashRaw, 'base64url');

      if (salt.byteLength < 8 || hash.byteLength === 0) {
        return null;
      }

      return {
        ...parsedParams,
        salt,
        hash,
      };
    } catch {
      return null;
    }
  }

  private parseScryptParams(
    raw: string,
  ): Omit<EncodedScryptHashParts, 'salt' | 'hash'> | null {
    const parts = raw.split(',');
    if (parts.length !== 4) {
      return null;
    }

    const values = new Map<string, number>();
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (!key || !value) {
        return null;
      }

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
      }

      values.set(key, parsed);
    }

    const n = values.get('n');
    const r = values.get('r');
    const p = values.get('p');
    const keyLength = values.get('l');
    if (!n || !r || !p || !keyLength) {
      return null;
    }

    return { n, r, p, keyLength };
  }
}
