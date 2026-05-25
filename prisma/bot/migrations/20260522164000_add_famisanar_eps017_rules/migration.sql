INSERT INTO `bot_allowed_eps` (`code`, `name`, `is_active`)
VALUES ('EPS017', 'FAMISANAR', true)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = CURRENT_TIMESTAMP(3);

UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = false,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'EPS017'
  AND (
    `user_type_code` NOT IN ('01', '02', '04')
    OR `specialty_code` <> '890201'
    OR `sex_rule` <> 'ANY'
  );

INSERT INTO `bot_eps_specialty_rules` (
  `eps_code`,
  `user_type_code`,
  `sex_rule`,
  `specialty_code`,
  `is_active`
)
VALUES
  ('EPS017', '01', 'ANY', '890201', true),
  ('EPS017', '02', 'ANY', '890201', true),
  ('EPS017', '04', 'ANY', '890201', true)
ON DUPLICATE KEY UPDATE
  `is_active` = VALUES(`is_active`),
  `updated_at` = CURRENT_TIMESTAMP(3);
