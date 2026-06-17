CREATE TABLE `bot_satisfaction_survey_runtime_settings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `scope_key` VARCHAR(32) NOT NULL,
  `send_mode` VARCHAR(16) NOT NULL,
  `send_rollout_percent` INTEGER NOT NULL,
  `emergency_pause_enabled` BOOLEAN NOT NULL,
  `dispatch_enabled` BOOLEAN NOT NULL,
  `eligibility_limit` INTEGER NOT NULL,
  `expiration_hours` INTEGER NOT NULL,
  `schedule_profile` VARCHAR(32) NOT NULL,
  `scheduler_loop_enabled` BOOLEAN NOT NULL,
  `tick_interval_ms` INTEGER NOT NULL,
  `slot_lock_ttl_seconds` INTEGER NOT NULL,
  `max_dispatches_per_run` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updated_by_admin_user_id` INTEGER NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_satisfaction_survey_runtime_settings_scope_key`(`scope_key`),
  INDEX `idx_bot_satisfaction_survey_runtime_settings_updated_at`(`updated_at`),
  INDEX `idx_bot_satisfaction_survey_runtime_settings_updated_by`(`updated_by_admin_user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_satisfaction_survey_runtime_settings_updated_by`
    FOREIGN KEY (`updated_by_admin_user_id`) REFERENCES `bot_admin_users`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_satisfaction_survey_runtime_setting_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `settings_version` INTEGER NOT NULL,
  `admin_user_id` INTEGER NULL,
  `change_type` VARCHAR(32) NOT NULL,
  `section` VARCHAR(16) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `previous_snapshot_json` JSON NOT NULL,
  `new_snapshot_json` JSON NOT NULL,
  `effective_snapshot_json` JSON NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_satisfaction_survey_runtime_events_version`(`settings_version`),
  INDEX `idx_bot_satisfaction_survey_runtime_events_admin_occurred`(`admin_user_id`, `occurred_at`),
  INDEX `idx_bot_satisfaction_survey_runtime_events_section_occurred`(`section`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_satisfaction_survey_runtime_events_admin_user`
    FOREIGN KEY (`admin_user_id`) REFERENCES `bot_admin_users`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
