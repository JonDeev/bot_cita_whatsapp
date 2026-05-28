import { Injectable } from '@nestjs/common';

const DEFAULT_SESSION_COOKIE_NAME = '__Host-sism_admin_session';
const DEFAULT_SESSION_TTL_HOURS = 12;
const DEFAULT_THROTTLE_WINDOW_SECONDS = 900;
const DEFAULT_MAX_FAILED_ATTEMPTS_PER_IP = 30;
const DEFAULT_MAX_FAILED_ATTEMPTS_PER_IDENTIFIER = 10;
const DEFAULT_ARGON2_PASSES = 3;
const DEFAULT_ARGON2_MEMORY_KIB = 65536;
const DEFAULT_ARGON2_PARALLELISM = 1;
const DEFAULT_ARGON2_TAG_LENGTH = 32;
const DEFAULT_COOKIE_SECURE = true;

@Injectable()
export class AdminAuthConfigService {
  isProductionEnvironment(): boolean {
    return (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  }

  getSessionCookieName(): string {
    const cookieName = this.readString(
      'ADMIN_AUTH_SESSION_COOKIE_NAME',
      DEFAULT_SESSION_COOKIE_NAME,
    );

    if (!cookieName.startsWith('__Host-')) {
      throw new Error(
        `Invalid ADMIN_AUTH_SESSION_COOKIE_NAME value "${cookieName}". Expected "__Host-" prefix.`,
      );
    }

    return cookieName;
  }

  getSessionTtlHours(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_SESSION_TTL_HOURS',
      DEFAULT_SESSION_TTL_HOURS,
    );
  }

  getThrottleWindowSeconds(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS',
      DEFAULT_THROTTLE_WINDOW_SECONDS,
    );
  }

  getMaxFailedAttemptsPerIp(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_LOGIN_MAX_ATTEMPTS_PER_IP',
      DEFAULT_MAX_FAILED_ATTEMPTS_PER_IP,
    );
  }

  getMaxFailedAttemptsPerIdentifier(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_LOGIN_MAX_ATTEMPTS_PER_IDENTIFIER',
      DEFAULT_MAX_FAILED_ATTEMPTS_PER_IDENTIFIER,
    );
  }

  getCookieSecure(): boolean {
    return this.readBoolean('ADMIN_AUTH_COOKIE_SECURE', DEFAULT_COOKIE_SECURE);
  }

  getArgon2Passes(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_ARGON2_PASSES',
      DEFAULT_ARGON2_PASSES,
    );
  }

  getArgon2MemoryKib(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_ARGON2_MEMORY_KIB',
      DEFAULT_ARGON2_MEMORY_KIB,
    );
  }

  getArgon2Parallelism(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_ARGON2_PARALLELISM',
      DEFAULT_ARGON2_PARALLELISM,
    );
  }

  getArgon2TagLength(): number {
    return this.readPositiveInt(
      'ADMIN_AUTH_ARGON2_TAG_LENGTH',
      DEFAULT_ARGON2_TAG_LENGTH,
    );
  }

  getDummyPasswordHash(): string | null {
    const value = process.env.ADMIN_AUTH_DUMMY_PASSWORD_HASH?.trim();
    return value && value.length > 0 ? value : null;
  }

  private readString(name: string, fallback: string): string {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private readPositiveInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw || raw.trim().length === 0) {
      return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `Invalid ${name} value "${raw}". Expected positive integer.`,
      );
    }

    return parsed;
  }

  private readBoolean(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw || raw.trim().length === 0) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }

    throw new Error(`Invalid ${name} value "${raw}". Expected boolean.`);
  }
}
