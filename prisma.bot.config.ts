import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/bot/schema.prisma',
  migrations: {
    path: 'prisma/bot/migrations',
  },
  datasource: {
    url: process.env['BOT_MIGRATION_DATABASE_URL'] ?? process.env['BOT_DATABASE_URL'] ?? '',
  },
});
