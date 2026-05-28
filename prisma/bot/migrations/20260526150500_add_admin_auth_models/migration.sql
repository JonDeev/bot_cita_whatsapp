CREATE TABLE `bot_admin_users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `username` VARCHAR(32) NOT NULL,
  `display_name` VARCHAR(120) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'SUPERVISOR', 'ASESOR') NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_admin_users_email`(`email`),
  UNIQUE INDEX `uq_bot_admin_users_username`(`username`),
  INDEX `idx_bot_admin_users_role_status`(`role`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_admin_sessions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `session_token_hash` VARCHAR(191) NOT NULL,
  `csrf_token_hash` VARCHAR(191) NULL,
  `ip_hash` VARCHAR(128) NULL,
  `user_agent` VARCHAR(512) NULL,
  `last_seen_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_admin_sessions_token_hash`(`session_token_hash`),
  INDEX `idx_bot_admin_sessions_user_expires_at`(`user_id`, `expires_at`),
  INDEX `idx_bot_admin_sessions_expires_revoked`(`expires_at`, `revoked_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_admin_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `bot_admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_admin_audit_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `admin_user_id` INTEGER NULL,
  `action` VARCHAR(128) NOT NULL,
  `resource_type` VARCHAR(64) NULL,
  `resource_id` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `ip_hash` VARCHAR(128) NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_admin_audit_events_action_occurred_at`(`action`, `occurred_at`),
  INDEX `idx_bot_admin_audit_events_user_occurred_at`(`admin_user_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_admin_audit_events_user` FOREIGN KEY (`admin_user_id`) REFERENCES `bot_admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
