# WhatsApp Webhook Hardening Rollout

## Scope

This runbook applies the replay-hardening changes introduced in commit `9bb0703`.

Goal:

1. Prevent stale or replayed interactive events from triggering automatic bot responses.
2. Persist webhook inbox records with deterministic idempotency keys.
3. Keep session recovery durable when Redis does not have active state.

## Pre-deploy checks

Run from project root:

```bash
pnpm prisma:bot:validate
pnpm build
```

Expected:

1. Prisma schema valid.
2. Build passes with no TypeScript errors.

## Required environment variables

Set these variables in the runtime environment before restarting the app:

```bash
WHATSAPP_STORE_WEBHOOK_PAYLOADS=true
WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS=900
WHATSAPP_TEXT_EVENT_MAX_AGE_SECONDS=86400
WHATSAPP_RESTORE_SESSION_FROM_PERSISTENCE=true
```

Notes:

1. `WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS` is the critical replay control for stale interactive replies.
2. Keep `WHATSAPP_AUTO_REPLY_ENABLED` according to your operational policy.

## Database migration

Apply migrations with the bot migration user:

```bash
pnpm prisma:bot:migrate:deploy
```

Verify status:

```bash
pnpm exec prisma migrate status --schema prisma/bot/schema.prisma --config prisma.bot.config.ts
```

Expected:

1. `Database schema is up to date!`

## Restart

Restart the application process so it picks new env values.

Use your process manager command, for example:

```bash
# pm2 example
pm2 restart <app-name>
```

or

```bash
# systemd example
sudo systemctl restart <service-name>
```

## Post-deploy smoke (recommended)

### 1) Send a signed stale interactive webhook

Use an old provider timestamp in payload and current timestamp in reception.

Expected:

1. HTTP 200 from `/whatsapp/webhook`.
2. No automatic conversational response for that stale event.

### 2) Validate inbox status

Query:

```sql
SELECT
  deduplication_key,
  event_kind,
  message_type,
  provider_occurred_at,
  received_at,
  processing_status,
  rejection_reason
FROM bot_webhook_events
ORDER BY id DESC
LIMIT 20;
```

Expected stale event record:

1. `processing_status = 'SKIPPED_STALE'`
2. `rejection_reason = 'INTERACTIVE_EVENT_TOO_OLD'`

### 3) Validate audit evidence

Query:

```sql
SELECT
  action,
  occurred_at,
  JSON_EXTRACT(metadata, '$.messageId') AS message_id,
  JSON_EXTRACT(metadata, '$.rejectionReason') AS rejection_reason
FROM bot_audit_events
WHERE action IN ('whatsapp.webhook.event_accepted', 'whatsapp.webhook.stale_skipped')
ORDER BY id DESC
LIMIT 30;
```

Expected:

1. `whatsapp.webhook.stale_skipped` present for stale test message.
2. `whatsapp.webhook.event_accepted` present for valid recent message.

## Rollback strategy

If unexpected rejects occur:

1. Increase `WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS` temporarily.
2. Restart service.
3. Re-run smoke checks.

Do not disable signature verification or durable idempotency as rollback shortcuts.

## Operational guardrails

1. Keep all backend timestamps in UTC.
2. Convert to `America/Bogota` only for UI/reporting.
3. Monitor `bot_webhook_events.processing_status` distribution after deploy.
4. Alert on spikes in `SKIPPED_STALE` and `FAILED`.
