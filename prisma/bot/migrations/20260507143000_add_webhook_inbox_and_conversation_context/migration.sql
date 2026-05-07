ALTER TABLE `bot_conversations`
  ADD COLUMN `context` JSON NULL;

ALTER TABLE `bot_messages`
  ADD COLUMN `provider_occurred_at` DATETIME(3) NULL,
  ADD COLUMN `received_at` DATETIME(3) NULL,
  ADD COLUMN `sent_at` DATETIME(3) NULL;

CREATE TABLE `bot_webhook_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `deduplication_key` VARCHAR(191) NOT NULL,
  `provider_message_id` VARCHAR(191) NOT NULL,
  `event_kind` VARCHAR(64) NOT NULL,
  `phone_number_id` VARCHAR(64) NULL,
  `participant_phone` VARCHAR(32) NULL,
  `message_type` VARCHAR(64) NULL,
  `interactive_reply_id` VARCHAR(191) NULL,
  `context_message_id` VARCHAR(191) NULL,
  `provider_occurred_at` DATETIME(3) NOT NULL,
  `received_at` DATETIME(3) NOT NULL,
  `processed_at` DATETIME(3) NULL,
  `signature_valid` BOOLEAN NOT NULL DEFAULT false,
  `payload_hash` VARCHAR(64) NOT NULL,
  `payload` JSON NULL,
  `processing_status` ENUM('RECEIVED', 'PROCESSED', 'SKIPPED_STALE', 'SKIPPED_INVALID_CONTEXT', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
  `rejection_reason` VARCHAR(64) NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_webhook_events_deduplication_key`(`deduplication_key`),
  INDEX `idx_bot_webhook_events_provider_message_id`(`provider_message_id`),
  INDEX `idx_bot_webhook_events_event_kind_received_at`(`event_kind`, `received_at`),
  INDEX `idx_bot_webhook_events_participant_phone_received_at`(`participant_phone`, `received_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
