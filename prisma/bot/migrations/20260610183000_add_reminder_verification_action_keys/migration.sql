ALTER TABLE `bot_appointment_reminder_dispatches`
  ADD COLUMN `verification_confirm_action_key` VARCHAR(64) NULL AFTER `verification_token_hash`,
  ADD COLUMN `verification_reject_action_key` VARCHAR(64) NULL AFTER `verification_confirm_action_key`;

CREATE UNIQUE INDEX `uq_bot_appt_reminder_verification_confirm_action_key`
  ON `bot_appointment_reminder_dispatches`(`verification_confirm_action_key`);

CREATE UNIQUE INDEX `uq_bot_appt_reminder_verification_reject_action_key`
  ON `bot_appointment_reminder_dispatches`(`verification_reject_action_key`);
