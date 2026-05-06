CREATE TABLE `bot_allowed_eps` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_allowed_eps_code`(`code`),
  INDEX `idx_bot_allowed_eps_is_active`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `bot_allowed_eps` (`code`, `name`, `is_active`)
VALUES
  ('EPS042', 'COOSALUD', true),
  ('EPS008', 'COMPENSAR', true),
  ('FIDU24', 'FOMAG', true)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `is_active` = VALUES(`is_active`);
