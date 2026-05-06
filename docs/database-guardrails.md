# Database Guardrails (Production SISM)

This project connects to the production MySQL database. The following rules are mandatory:

1. Never run migrations against the legacy SISM database.
2. Never run seeds against the legacy SISM database.
3. Never create, alter, or drop tables in the legacy SISM database.
4. Never insert/update/delete records in these tables: `usuarios`, `empleados`, `tvespecialidades`, `especialidad_empleados`, `tventidades`.
5. `agenda` can only be updated with explicit human authorization, and never used to create new appointment slots (`INSERT` is forbidden).
6. All Prisma usage for legacy entities is read-oriented by default.
7. Prisma schema is intentionally scoped to these tables only: `usuarios`, `agenda`, `empleados`, `tvespecialidades`, `especialidad_empleados`, `tventidades`.

## WhatsApp bot database

Bot persistence must live in a separate MySQL database named `whatsapp_bot`.

Use this database for:

- Conversations.
- Messages.
- Sessions.
- Allowed EPS contracts (`bot_allowed_eps`).
- Human handoffs.
- Template sends.
- Document delivery metadata.
- Audit events.
- Outbox messages.

Do not create bot tables inside the clinical SISM schema. Do not point bot persistence to `SISM_DATABASE_URL`.

Production accounts:

- `whatsapp_bot_app`: runtime account with `SELECT`, `INSERT`, `UPDATE`, and `DELETE` only on `whatsapp_bot.*`.
- `whatsapp_bot_migrator`: deployment/migration account with scoped DDL privileges only on `whatsapp_bot.*`.
- DBA/admin credentials must be used only for one-time bootstrap and kept out of runtime containers.

Bootstrap options:

- Scripted: `pnpm db:create:whatsapp-bot` with `MYSQL_ADMIN_*`, `BOT_DATABASE_*_USER`, and `BOT_DATABASE_*_PASSWORD` variables set.
- Manual SQL: `ops/database/001-create-whatsapp-bot-database.sql`.
- Prisma bot schema: `prisma/bot/schema.prisma` with migrations in `prisma/bot/migrations`.
- Prisma bot commands: `pnpm prisma:bot:generate`, `pnpm prisma:bot:migrate:deploy`.

Operational recommendation:
- Use a read-only DB user for normal execution.
- Use a separate credential with limited update permission to `agenda` only when explicitly authorized.
- Use a separate runtime credential for `whatsapp_bot`, never the legacy clinical credential.

Implementation notes in this repository:
- `prisma/schema.prisma` is the clean, working schema used by Prisma Client.
- `prisma/schema.full-introspection.invalid.prisma` stores the raw full pull snapshot for reference/audit.
- Runtime guardrail in `src/shared/infrastructure/prisma/prisma.service.ts` blocks writes by default.
