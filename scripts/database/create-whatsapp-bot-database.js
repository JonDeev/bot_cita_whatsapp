const fs = require('fs');
const mariadb = require('mariadb');

const DEFAULT_DATABASE_NAME = 'whatsapp_bot';
const DEFAULT_APP_USER = 'whatsapp_bot_app';
const DEFAULT_MIGRATION_USER = 'whatsapp_bot_migrator';
const DEFAULT_USER_HOST = '%';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return;
  }

  const text = fs.readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    const first = value[0];
    const last = value[value.length - 1];

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

function validateIdentifier(value, label) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, and underscores.`);
  }
}

function validateUserHost(value) {
  if (!/^[A-Za-z0-9_.:%-]+$/.test(value)) {
    throw new Error('Database user host contains unsupported characters.');
  }
}

function quoteIdentifier(identifier) {
  return `\`${identifier}\``;
}

function quoteUser(conn, user, host) {
  return `${conn.escape(user)}@${conn.escape(host)}`;
}

async function main() {
  loadEnvFile('.env');

  const databaseName = optionalEnv('BOT_DATABASE_NAME', DEFAULT_DATABASE_NAME);
  const appUser = optionalEnv('BOT_DATABASE_APP_USER', DEFAULT_APP_USER);
  const migrationUser = optionalEnv('BOT_DATABASE_MIGRATION_USER', DEFAULT_MIGRATION_USER);
  const userHost = optionalEnv('BOT_DATABASE_USER_HOST', DEFAULT_USER_HOST);

  validateIdentifier(databaseName, 'BOT_DATABASE_NAME');
  validateIdentifier(appUser, 'BOT_DATABASE_APP_USER');
  validateIdentifier(migrationUser, 'BOT_DATABASE_MIGRATION_USER');
  validateUserHost(userHost);

  const appPassword = requiredEnv('BOT_DATABASE_APP_PASSWORD');
  const migrationPassword = requiredEnv('BOT_DATABASE_MIGRATION_PASSWORD');

  let conn;
  try {
    conn = await mariadb.createConnection({
      host: requiredEnv('MYSQL_ADMIN_HOST'),
      port: Number(requiredEnv('MYSQL_ADMIN_PORT')),
      user: requiredEnv('MYSQL_ADMIN_USER'),
      password: requiredEnv('MYSQL_ADMIN_PASSWORD'),
      multipleStatements: false,
    });

    const db = quoteIdentifier(databaseName);
    const appAccount = quoteUser(conn, appUser, userHost);
    const migrationAccount = quoteUser(conn, migrationUser, userHost);

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    await conn.query(`CREATE USER IF NOT EXISTS ${appAccount} IDENTIFIED BY ?`, [appPassword]);
    await conn.query(`CREATE USER IF NOT EXISTS ${migrationAccount} IDENTIFIED BY ?`, [
      migrationPassword,
    ]);

    await conn.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${db}.* TO ${appAccount}`);
    await conn.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES ON ${db}.* TO ${migrationAccount}`,
    );

    const rows = await conn.query(
      'SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [databaseName],
    );

    const schema = rows[0];
    if (!schema) {
      throw new Error(`Database ${databaseName} was not found after bootstrap.`);
    }

    console.log(
      `database=${schema.SCHEMA_NAME} charset=${schema.DEFAULT_CHARACTER_SET_NAME} collation=${schema.DEFAULT_COLLATION_NAME}`,
    );
    console.log(`runtime_user=${appUser}@${userHost}`);
    console.log(`migration_user=${migrationUser}@${userHost}`);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main().catch((error) => {
  console.error(error.code ? `${error.code}: ${error.message}` : error.message);
  process.exit(1);
});
