ALTER TABLE `bot_conversations`
  ADD COLUMN `last_inbound_at` DATETIME(3) NULL AFTER `context`,
  ADD COLUMN `idle_reminder_sent_at` DATETIME(3) NULL AFTER `last_inbound_at`,
  ADD COLUMN `idle_expires_at` DATETIME(3) NULL AFTER `idle_reminder_sent_at`;

CREATE INDEX `idx_bot_conversations_status_idle_expires_at`
  ON `bot_conversations` (`status`, `idle_expires_at`);

CREATE INDEX `idx_bot_conversations_status_last_inbound_at`
  ON `bot_conversations` (`status`, `last_inbound_at`);
