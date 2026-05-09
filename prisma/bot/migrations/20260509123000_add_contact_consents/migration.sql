CREATE TABLE `bot_contact_consent_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `patient_legacy_user_id` INTEGER NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `channel` ENUM('WHATSAPP') NOT NULL,
  `source` VARCHAR(64) NOT NULL,
  `consent_text_snapshot` TEXT NOT NULL,
  `policy_url` VARCHAR(255) NULL,
  `policy_version` VARCHAR(64) NULL,
  `response` ENUM('ACCEPTED', 'DECLINED') NOT NULL,
  `responded_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_contact_consent_events_patient_responded_at`(`patient_legacy_user_id`, `responded_at`),
  INDEX `idx_bot_contact_consent_events_phone_responded_at`(`phone`, `responded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_patient_contact_consents` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `consent_event_id` INTEGER NOT NULL,
  `patient_legacy_user_id` INTEGER NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `channel` ENUM('WHATSAPP') NOT NULL,
  `purpose` ENUM('APPOINTMENT_NOTIFICATIONS', 'SATISFACTION_SURVEYS') NOT NULL,
  `granted` BOOLEAN NOT NULL,
  `granted_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_patient_contact_consents_patient_channel_purpose`(`patient_legacy_user_id`, `channel`, `purpose`),
  INDEX `idx_bot_patient_contact_consents_phone_channel_purpose`(`phone`, `channel`, `purpose`),
  INDEX `idx_bot_patient_contact_consents_granted_purpose`(`granted`, `purpose`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_patient_contact_consents_consent_event` FOREIGN KEY (`consent_event_id`) REFERENCES `bot_contact_consent_events`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
