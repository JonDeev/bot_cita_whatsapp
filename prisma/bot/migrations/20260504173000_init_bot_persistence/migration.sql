CREATE TABLE `bot_conversations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_key` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(32) NOT NULL,
  `participant_phone` VARCHAR(32) NOT NULL,
  `phone_number_id` VARCHAR(64) NULL,
  `state` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_conversations_conversation_key`(`conversation_key`),
  INDEX `idx_bot_conversations_participant_phone`(`participant_phone`),
  INDEX `idx_bot_conversations_updated_at`(`updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER NOT NULL,
  `direction` ENUM('INBOUND', 'OUTBOUND', 'SYSTEM') NOT NULL,
  `whatsapp_message_id` VARCHAR(191) NULL,
  `message_type` VARCHAR(64) NOT NULL,
  `body` TEXT NULL,
  `payload` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_messages_whatsapp_message_id`(`whatsapp_message_id`),
  INDEX `idx_bot_messages_conversation_occurred_at`(`conversation_id`, `occurred_at`),
  INDEX `idx_bot_messages_direction_occurred_at`(`direction`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `bot_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_audit_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `action` VARCHAR(128) NOT NULL,
  `conversation_key` VARCHAR(191) NULL,
  `conversation_id` INTEGER NULL,
  `metadata` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_audit_events_action_occurred_at`(`action`, `occurred_at`),
  INDEX `idx_bot_audit_events_conversation_key`(`conversation_key`),
  INDEX `idx_bot_audit_events_conversation_id`(`conversation_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_audit_events_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `bot_conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_handoffs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `assigned_to` VARCHAR(64) NULL,
  `note` TEXT NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  INDEX `idx_bot_handoffs_conversation_is_active`(`conversation_id`, `is_active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_handoffs_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `bot_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_outbox_messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER NULL,
  `channel` VARCHAR(32) NOT NULL,
  `recipient_phone` VARCHAR(32) NOT NULL,
  `payload` JSON NOT NULL,
  `deduplication_key` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `failed_at` DATETIME(3) NULL,
  `error_code` VARCHAR(64) NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_outbox_deduplication_key`(`deduplication_key`),
  INDEX `idx_bot_outbox_status_next_attempt_at`(`status`, `next_attempt_at`),
  INDEX `idx_bot_outbox_conversation_id`(`conversation_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_outbox_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `bot_conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
