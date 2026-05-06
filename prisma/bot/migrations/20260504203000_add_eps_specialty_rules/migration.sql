CREATE TABLE `bot_user_types` (
  `code` VARCHAR(2) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_bot_user_types_is_active`(`is_active`),
  PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_eps_specialty_rules` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `eps_code` VARCHAR(30) NOT NULL,
  `user_type_code` VARCHAR(2) NOT NULL,
  `sex_rule` ENUM('ANY', 'H', 'M') NOT NULL DEFAULT 'ANY',
  `specialty_code` VARCHAR(20) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_bot_eps_specialty_rules_business`(`eps_code`, `user_type_code`, `sex_rule`, `specialty_code`),
  INDEX `idx_bot_eps_specialty_rules_eps_active`(`eps_code`, `is_active`),
  INDEX `idx_bot_eps_specialty_rules_user_type_active`(`user_type_code`, `is_active`),
  INDEX `idx_bot_eps_specialty_rules_sex_active`(`sex_rule`, `is_active`),
  INDEX `idx_bot_eps_specialty_rules_specialty_code`(`specialty_code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bot_eps_specialty_rules_eps_code`
    FOREIGN KEY (`eps_code`) REFERENCES `bot_allowed_eps`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_bot_eps_specialty_rules_user_type_code`
    FOREIGN KEY (`user_type_code`) REFERENCES `bot_user_types`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `bot_user_types` (`code`, `name`, `is_active`)
VALUES
  ('01', 'Contributivo cotizante', true),
  ('02', 'Contributivo beneficiario', true),
  ('03', 'Contributivo adicional', true),
  ('04', 'Subsidiado', true),
  ('05', 'No afiliado', true),
  ('06', 'Especial o Excepcion cotizante', true),
  ('07', 'Especial o Excepcion beneficiario', true),
  ('08', 'Personas privadas de la libertad a cargo del Fondo Nacional de Salud', true),
  ('09', 'Tomador / Amparado ARL', true),
  ('10', 'Tomador / Amparado SOAT', true)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `bot_eps_specialty_rules` (
  `eps_code`,
  `user_type_code`,
  `sex_rule`,
  `specialty_code`,
  `is_active`
)
SELECT
  allowed_eps.`code` AS `eps_code`,
  user_types.`code` AS `user_type_code`,
  'ANY' AS `sex_rule`,
  specialties.`specialty_code` AS `specialty_code`,
  true AS `is_active`
FROM `bot_allowed_eps` AS allowed_eps
CROSS JOIN (
  SELECT '01' AS `code`
  UNION ALL SELECT '02'
  UNION ALL SELECT '03'
  UNION ALL SELECT '04'
  UNION ALL SELECT '05'
  UNION ALL SELECT '06'
  UNION ALL SELECT '07'
  UNION ALL SELECT '08'
  UNION ALL SELECT '09'
  UNION ALL SELECT '10'
) AS user_types
CROSS JOIN (
  SELECT '890201' AS `specialty_code`
  UNION ALL SELECT '890206'
  UNION ALL SELECT '890208'
  UNION ALL SELECT '890203'
) AS specialties
WHERE allowed_eps.`code` IN ('EPS042', 'EPS008', 'FIDU24')
ON DUPLICATE KEY UPDATE
  `is_active` = VALUES(`is_active`),
  `updated_at` = CURRENT_TIMESTAMP(3);
