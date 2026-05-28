const { argon2Sync, randomBytes, scryptSync } = require('node:crypto');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@whatsapp-bot/prisma-client');
require('dotenv/config');

const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;
const ARGON2_PASSWORD_HASH_PREFIX = 'argon2id$v1';
const SCRYPT_PASSWORD_HASH_PREFIX = 'scrypt$v1';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function validateUsername(username) {
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(
      `Invalid ADMIN_BOOTSTRAP_USERNAME "${username}". Expected regex ${USERNAME_REGEX}.`,
    );
  }

  if (username.includes('@')) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME must not contain @.');
  }
}

function readRole() {
  const role = (process.env.ADMIN_BOOTSTRAP_ROLE || 'ADMIN').trim().toUpperCase();
  if (!['ADMIN', 'SUPERVISOR'].includes(role)) {
    throw new Error('ADMIN_BOOTSTRAP_ROLE must be ADMIN or SUPERVISOR.');
  }

  return role;
}

function readDisplayName() {
  const displayName = (process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || 'Admin SISM')
    .trim()
    .slice(0, 120);

  if (!displayName) {
    throw new Error('ADMIN_BOOTSTRAP_DISPLAY_NAME cannot be empty.');
  }

  return displayName;
}

function hashPassword(password) {
  if (typeof argon2Sync === 'function') {
    const passes = Number.parseInt(process.env.ADMIN_AUTH_ARGON2_PASSES || '3', 10);
    const memory = Number.parseInt(
      process.env.ADMIN_AUTH_ARGON2_MEMORY_KIB || '65536',
      10,
    );
    const parallelism = Number.parseInt(
      process.env.ADMIN_AUTH_ARGON2_PARALLELISM || '1',
      10,
    );
    const tagLength = Number.parseInt(
      process.env.ADMIN_AUTH_ARGON2_TAG_LENGTH || '32',
      10,
    );

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

async function main() {
  const connectionString = requiredEnv('BOT_DATABASE_URL');
  const email = normalizeEmail(requiredEnv('ADMIN_BOOTSTRAP_EMAIL'));
  const username = normalizeUsername(
    process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin',
  );
  const displayName = readDisplayName();
  const role = readRole();
  const password = requiredEnv('ADMIN_BOOTSTRAP_PASSWORD');
  const allowUpdate = process.env.ADMIN_BOOTSTRAP_ALLOW_UPDATE === 'true';

  validateUsername(username);

  const adapter = new PrismaMariaDb(connectionString);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    const existingByEmail = await prisma.botAdminUser.findUnique({
      where: { email },
      select: { id: true, username: true },
    });
    const existingByUsername = await prisma.botAdminUser.findUnique({
      where: { username },
      select: { id: true, email: true },
    });

    if (existingByEmail && existingByUsername && existingByEmail.id !== existingByUsername.id) {
      throw new Error(
        'Bootstrap conflict: email and username belong to different users.',
      );
    }

    const existing = existingByEmail || existingByUsername;
    const passwordHash = hashPassword(password);

    if (!existing) {
      const created = await prisma.botAdminUser.create({
        data: {
          email,
          username,
          displayName,
          passwordHash,
          role,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      console.log(`Created initial admin user id=${created.id} username=${username}`);
      return;
    }

    if (!allowUpdate) {
      console.log(
        `Admin user already exists id=${existing.id}. Skipping update (set ADMIN_BOOTSTRAP_ALLOW_UPDATE=true to update).`,
      );
      return;
    }

    await prisma.botAdminUser.update({
      where: { id: existing.id },
      data: {
        email,
        username,
        displayName,
        passwordHash,
        role,
        status: 'ACTIVE',
      },
    });

    console.log(`Updated existing admin user id=${existing.id} username=${username}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
