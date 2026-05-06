-- WhatsApp Bot database bootstrap.
-- Run this with a DBA/admin MySQL user, not with the application user.
-- Replace CHANGE_ME_* values before execution and store real passwords only
-- in a secret manager or local .env file that is not committed.

CREATE DATABASE IF NOT EXISTS `whatsapp_bot`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'whatsapp_bot_app'@'%'
  IDENTIFIED BY 'CHANGE_ME_STRONG_APP_PASSWORD';

CREATE USER IF NOT EXISTS 'whatsapp_bot_migrator'@'%'
  IDENTIFIED BY 'CHANGE_ME_STRONG_MIGRATION_PASSWORD';

-- Runtime account: DML only. No DDL, no GRANT OPTION.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON `whatsapp_bot`.*
  TO 'whatsapp_bot_app'@'%';

-- Migration account: scoped DDL only on the bot database.
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES
  ON `whatsapp_bot`.*
  TO 'whatsapp_bot_migrator'@'%';

-- CREATE USER and GRANT persist immediately in MySQL/MariaDB.
