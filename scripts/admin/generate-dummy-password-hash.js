const { argon2Sync, randomBytes, scryptSync } = require('node:crypto');

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value "${raw}". Expected positive integer.`);
  }

  return parsed;
}

function generateArgon2idHash(password) {
  const memory = readPositiveInt('ADMIN_AUTH_ARGON2_MEMORY_KIB', 65536);
  const passes = readPositiveInt('ADMIN_AUTH_ARGON2_PASSES', 3);
  const parallelism = readPositiveInt('ADMIN_AUTH_ARGON2_PARALLELISM', 1);
  const tagLength = readPositiveInt('ADMIN_AUTH_ARGON2_TAG_LENGTH', 32);
  const salt = randomBytes(16);

  const hash = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    memory,
    passes,
    parallelism,
    tagLength,
  });

  return `argon2id$v1$m=${memory},t=${passes},p=${parallelism},l=${tagLength}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function generateScryptHash(password) {
  const n = 1 << 15;
  const r = 8;
  const p = 1;
  const keyLength = 32;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, keyLength, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$v1$n=${n},r=${r},p=${p},l=${keyLength}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function main() {
  const password = process.env.ADMIN_AUTH_DUMMY_PASSWORD_PLAINTEXT?.trim() || '__admin_dummy_password__';

  if (typeof argon2Sync === 'function') {
    console.log(generateArgon2idHash(password));
    return;
  }

  console.warn(
    'Warning: argon2Sync is not available in this Node runtime. Generated fallback scrypt hash.',
  );
  console.log(generateScryptHash(password));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
