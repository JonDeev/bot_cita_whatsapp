-- Prune bot_eps_specialty_rules according to EPS policy.
-- Note: We soft-disable rules (is_active=false) instead of deleting rows for auditability/traceability.

-- EPS042: keep only user_type_code 01, 02
UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = false,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'EPS042'
  AND `is_active` = true
  AND `user_type_code` NOT IN ('01', '02');

UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = true,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'EPS042'
  AND `is_active` = false
  AND `user_type_code` IN ('01', '02');

-- FIDU24: keep only user_type_code 06, 07
UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = false,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'FIDU24'
  AND `is_active` = true
  AND `user_type_code` NOT IN ('06', '07');

UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = true,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'FIDU24'
  AND `is_active` = false
  AND `user_type_code` IN ('06', '07');

-- EPS008: keep only (user_type_code IN 01,02,04) for specialties 890201, 890203
UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = false,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'EPS008'
  AND `is_active` = true
  AND (
    `user_type_code` NOT IN ('01', '02', '04')
    OR `specialty_code` NOT IN ('890201', '890203')
  );

UPDATE `bot_eps_specialty_rules`
SET
  `is_active` = true,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `eps_code` = 'EPS008'
  AND `is_active` = false
  AND `user_type_code` IN ('01', '02', '04')
  AND `specialty_code` IN ('890201', '890203');
