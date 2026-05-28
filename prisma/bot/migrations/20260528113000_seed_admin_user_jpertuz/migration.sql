-- Seed admin user for observability panel access.
-- Password is stored as a one-way hash (scrypt$v1 format supported by AdminPasswordHasherService).

INSERT INTO `bot_admin_users` (
  `email`,
  `username`,
  `display_name`,
  `password_hash`,
  `role`,
  `status`
)
SELECT
  'jpertuz@sism.com.co',
  'jpertuz',
  'Jpertuz',
  'scrypt$v1$n=32768,r=8,p=1,l=32$uUVfNSDatMsymIOmR4kaSw$wCs1HARBWJm8ykTjq5lbXlOVNi5XzZ7V9rXXRqj6FXI',
  'ADMIN',
  'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1
  FROM `bot_admin_users`
  WHERE `email` = 'jpertuz@sism.com.co'
     OR `username` = 'jpertuz'
);
