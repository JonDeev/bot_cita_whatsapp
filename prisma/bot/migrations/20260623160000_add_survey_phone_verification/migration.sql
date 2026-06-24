ALTER TABLE `bot_survey_dispatches`
  MODIFY COLUMN `status` ENUM(
    'PENDING',
    'PHONE_VERIFICATION_PENDING',
    'SENT',
    'STARTED',
    'COMPLETED',
    'DECLINED',
    'EXPIRED',
    'FAILED',
    'CANCELLED_BY_HANDOFF',
    'BLOCKED_CONTACT'
  ) NOT NULL DEFAULT 'PENDING';

ALTER TABLE `bot_survey_dispatches`
  ADD COLUMN `verification_template_name` VARCHAR(128) NULL AFTER `expires_at`,
  ADD COLUMN `verification_template_language` VARCHAR(16) NULL AFTER `verification_template_name`,
  ADD COLUMN `verification_confirm_action_key` VARCHAR(64) NULL AFTER `verification_template_language`,
  ADD COLUMN `verification_reject_action_key` VARCHAR(64) NULL AFTER `verification_confirm_action_key`,
  ADD COLUMN `verification_whatsapp_message_id` VARCHAR(191) NULL AFTER `verification_reject_action_key`,
  ADD COLUMN `verification_requested_at` DATETIME(3) NULL AFTER `verification_whatsapp_message_id`,
  ADD COLUMN `verification_confirmed_at` DATETIME(3) NULL AFTER `verification_requested_at`,
  ADD COLUMN `verification_rejected_at` DATETIME(3) NULL AFTER `verification_confirmed_at`,
  ADD COLUMN `verification_failed_at` DATETIME(3) NULL AFTER `verification_rejected_at`,
  ADD COLUMN `verification_failure_reason` TEXT NULL AFTER `verification_failed_at`,
  ADD INDEX `idx_bot_survey_dispatches_verification_whatsapp_message_id`(`verification_whatsapp_message_id`),
  ADD INDEX `idx_bot_survey_dispatches_verification_confirm_action_key`(`verification_confirm_action_key`),
  ADD INDEX `idx_bot_survey_dispatches_verification_reject_action_key`(`verification_reject_action_key`);
