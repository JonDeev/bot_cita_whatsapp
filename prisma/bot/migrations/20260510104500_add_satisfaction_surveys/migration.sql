CREATE TABLE `bot_survey_definitions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `version` INTEGER NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_definitions_code_version`(`code`, `version`),
  INDEX `idx_bot_survey_definitions_is_active`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_survey_questions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `survey_definition_id` INTEGER NOT NULL,
  `question_order` INTEGER NOT NULL,
  `question_key` VARCHAR(64) NOT NULL,
  `question_type` ENUM('SINGLE_CHOICE', 'FREE_TEXT') NOT NULL,
  `body` TEXT NOT NULL,
  `is_required` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_questions_definition_order`(`survey_definition_id`, `question_order`),
  UNIQUE INDEX `uq_bot_survey_questions_definition_key`(`survey_definition_id`, `question_key`),
  INDEX `idx_bot_survey_questions_question_type`(`question_type`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_survey_questions_definition` FOREIGN KEY (`survey_definition_id`) REFERENCES `bot_survey_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_survey_question_options` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `survey_question_id` INTEGER NOT NULL,
  `option_value` VARCHAR(32) NOT NULL,
  `option_label` VARCHAR(120) NOT NULL,
  `option_order` INTEGER NOT NULL,
  `is_terminal_action` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_question_options_question_value`(`survey_question_id`, `option_value`),
  INDEX `idx_bot_survey_question_options_question_order`(`survey_question_id`, `option_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_survey_question_options_question` FOREIGN KEY (`survey_question_id`) REFERENCES `bot_survey_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_survey_dispatches` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `survey_definition_id` INTEGER NOT NULL,
  `patient_legacy_user_id` INTEGER NOT NULL,
  `patient_name` VARCHAR(120) NOT NULL,
  `patient_phone` VARCHAR(32) NOT NULL,
  `patient_phone_e164` VARCHAR(32) NULL,
  `survey_date` DATE NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'STARTED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'FAILED', 'CANCELLED_BY_HANDOFF', 'BLOCKED_CONTACT') NOT NULL DEFAULT 'PENDING',
  `trigger_type` VARCHAR(64) NOT NULL,
  `window_start_at` DATETIME(3) NOT NULL,
  `window_end_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `conversation_key` VARCHAR(191) NULL,
  `initial_template_name` VARCHAR(128) NULL,
  `initial_template_language` VARCHAR(16) NULL,
  `initial_whatsapp_message_id` VARCHAR(191) NULL,
  `flow_token` VARCHAR(191) NULL,
  `flow_opened_at` DATETIME(3) NULL,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `declined_at` DATETIME(3) NULL,
  `expired_at` DATETIME(3) NULL,
  `failed_at` DATETIME(3) NULL,
  `failure_reason` TEXT NULL,
  `dedupe_key` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_dispatches_patient_survey_date`(`patient_legacy_user_id`, `survey_date`),
  UNIQUE INDEX `uq_bot_survey_dispatches_dedupe_key`(`dedupe_key`),
  INDEX `idx_bot_survey_dispatches_status_expires_at`(`status`, `expires_at`),
  INDEX `idx_bot_survey_dispatches_conversation_key`(`conversation_key`),
  INDEX `idx_bot_survey_dispatches_flow_token`(`flow_token`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_survey_dispatches_definition` FOREIGN KEY (`survey_definition_id`) REFERENCES `bot_survey_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_survey_dispatch_appointments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `survey_dispatch_id` INTEGER NOT NULL,
  `legacy_agenda_id` INTEGER NOT NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time_hhmm` VARCHAR(5) NOT NULL,
  `specialty_name` VARCHAR(120) NULL,
  `doctor_name` VARCHAR(120) NULL,
  `site_name` VARCHAR(120) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_dispatch_appointments_legacy_agenda_id`(`legacy_agenda_id`),
  INDEX `idx_bot_survey_dispatch_appointments_dispatch_id`(`survey_dispatch_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_survey_dispatch_appointments_dispatch` FOREIGN KEY (`survey_dispatch_id`) REFERENCES `bot_survey_dispatches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_survey_answers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `survey_dispatch_id` INTEGER NOT NULL,
  `survey_question_id` INTEGER NOT NULL,
  `answer_order` INTEGER NOT NULL,
  `selected_option_value` VARCHAR(32) NULL,
  `selected_option_label_snapshot` VARCHAR(120) NULL,
  `free_text_answer` TEXT NULL,
  `answered_at` DATETIME(3) NOT NULL,
  `source_message_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_survey_answers_dispatch_question`(`survey_dispatch_id`, `survey_question_id`),
  INDEX `idx_bot_survey_answers_answered_at`(`answered_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_survey_answers_dispatch` FOREIGN KEY (`survey_dispatch_id`) REFERENCES `bot_survey_dispatches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_bot_survey_answers_question` FOREIGN KEY (`survey_question_id`) REFERENCES `bot_survey_questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_contact_suppressions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `patient_legacy_user_id` INTEGER NULL,
  `phone` VARCHAR(32) NOT NULL,
  `channel` ENUM('WHATSAPP') NOT NULL,
  `reason` ENUM('UNKNOWN_PERSON', 'OPT_OUT_SURVEY', 'INVALID_PHONE', 'MANUAL_BLOCK') NOT NULL,
  `scope` VARCHAR(32) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `expires_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_contact_suppressions_phone_channel_active`(`phone`, `channel`, `active`),
  INDEX `idx_bot_contact_suppressions_patient_active`(`patient_legacy_user_id`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `bot_survey_definitions` (`code`, `version`, `name`, `is_active`)
VALUES ('POST_VISIT_SATISFACTION', 1, 'Encuesta de satisfaccion post atencion', true);

SET @survey_definition_id = LAST_INSERT_ID();

INSERT INTO `bot_survey_questions` (`survey_definition_id`, `question_order`, `question_key`, `question_type`, `body`, `is_required`)
VALUES
  (@survey_definition_id, 1, 'EASE_OF_SCHEDULING', 'SINGLE_CHOICE', '¿Considera usted que fue facil conseguir su cita con la IPS SISM?', true),
  (@survey_definition_id, 2, 'OVERALL_SATISFACTION', 'SINGLE_CHOICE', 'De acuerdo a su experiencia, ¿que tan satisfecho se encuentra con la atencion brindada?', true),
  (@survey_definition_id, 3, 'WOULD_RECOMMEND', 'SINGLE_CHOICE', '¿Recomendaria los servicios de la IPS con algun familiar y/o amigo?', true),
  (@survey_definition_id, 4, 'AREA_TO_IMPROVE', 'SINGLE_CHOICE', '¿En que te gustaria que mejoraramos para tu proxima visita?', true),
  (@survey_definition_id, 5, 'COMMENT', 'FREE_TEXT', 'Dejanos un comentario o recomendacion para seguir mejorando.', false);

SET @question_1_id = (SELECT `id` FROM `bot_survey_questions` WHERE `survey_definition_id` = @survey_definition_id AND `question_key` = 'EASE_OF_SCHEDULING');
SET @question_2_id = (SELECT `id` FROM `bot_survey_questions` WHERE `survey_definition_id` = @survey_definition_id AND `question_key` = 'OVERALL_SATISFACTION');
SET @question_3_id = (SELECT `id` FROM `bot_survey_questions` WHERE `survey_definition_id` = @survey_definition_id AND `question_key` = 'WOULD_RECOMMEND');
SET @question_4_id = (SELECT `id` FROM `bot_survey_questions` WHERE `survey_definition_id` = @survey_definition_id AND `question_key` = 'AREA_TO_IMPROVE');

INSERT INTO `bot_survey_question_options` (`survey_question_id`, `option_value`, `option_label`, `option_order`, `is_terminal_action`)
VALUES
  (@question_1_id, '1', 'SI', 1, false),
  (@question_1_id, '2', 'NO', 2, false),
  (@question_2_id, '4', '⭐⭐⭐⭐', 1, false),
  (@question_2_id, '3', '⭐⭐⭐', 2, false),
  (@question_2_id, '2', '⭐⭐', 3, false),
  (@question_2_id, '1', '⭐', 4, false),
  (@question_3_id, '1', 'SI', 1, false),
  (@question_3_id, '2', 'NO', 2, false),
  (@question_4_id, '1', 'EN LAS INSTALACIONES', 1, false),
  (@question_4_id, '2', 'EN LA ATENCION DE TU PROFESIONAL', 2, false),
  (@question_4_id, '3', 'EN LA ATENCION DE SERVICIO AL USUARIO', 3, false),
  (@question_4_id, '4', 'EN EL TIEMPO DE ESPERA EN LA SALA', 4, false),
  (@question_4_id, '5', 'EN NADA TODO ESTUVO BIEN', 5, false);
