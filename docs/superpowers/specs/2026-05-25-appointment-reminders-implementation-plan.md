# Implementation Plan: appointment reminders by WhatsApp (24h)

## Context

This plan operationalizes the approved design in:

- `docs/superpowers/specs/2026-05-25-appointment-reminders-design.md`

The goal is a production-grade reminder system with:

- strict idempotency
- lock safety across multiple workers
- no sensitive data leakage
- full auditability
- predictable runtime behavior under failures

## Delivery strategy

Use incremental delivery with feature flags and dark launch:

1. Write path + persistence first (no real sends)
2. Queue and dispatcher with mock adapter
3. Webhook button handling and idempotency
4. Real WhatsApp send in controlled rollout

## Workstreams

### WS1 - Data model and migrations

Deliverables:

- Prisma model for `bot_appointment_reminder_dispatches`
- Prisma model for `bot_webhook_inbound_dedup`
- required indexes and constraints

Required fields in `bot_appointment_reminder_dispatches`:

- identifiers: `id`, `legacy_agenda_id`, `patient_legacy_user_id`, `conversation_key`
- recipient: `recipient_phone_raw`, `recipient_phone_e164`
- schedule: `appointment_starts_at`, `scheduled_for`
- templates: `template_name`, `verification_template_name`
- transport ids: `meta_message_id`, `verification_message_id`
- retry: `attempts`, `next_attempt_at`, `last_error`
- lock/lease: `lock_acquired_at`, `lock_expires_at`, `locked_by`, `lock_version`
- verification: `verification_token_hash`, `verification_requested_at`, `verification_expires_at`
- state: `status`, `reminder_type`, `sent_at`, `created_at`, `updated_at`

Constraints and indexes:

- unique: `(legacy_agenda_id, reminder_type, appointment_starts_at)`
- index: `(status, scheduled_for)`
- index: `(status, next_attempt_at)`
- index: `(verification_expires_at, status)`
- index: `(lock_expires_at, status)`

`bot_webhook_inbound_dedup`:

- fields: `id`, `provider`, `inbound_message_id`, `button_payload_id`, `received_at`, `processed_at`, `result_status`
- unique: `(provider, inbound_message_id, button_payload_id)`

Exit criteria:

- migrations apply cleanly in local environment
- schema is generated and validated

### WS2 - Domain and application use cases

Deliverables:

- `create-or-refresh-appointment-reminder-dispatches.use-case.ts`
- `dispatch-due-appointment-reminders.use-case.ts`
- `confirm-appointment-reminder-phone.use-case.ts`
- `reject-appointment-reminder-phone.use-case.ts`

Rules to enforce:

- eligibility uses `agenda.Estado = 'Asignada'`
- source phone uses `usuarios.Tel_fono` (`@map("Teléfono")`)
- verification gate uses `usuarios.telefono_verificado_en`
- verification template `verificacion_telefono_paciente` sends `{{1}} = patientShortName`
- `patientShortName` is built as `trim(usuarios.Primer_nombre + ' ' + usuarios.Primer_apellido)`
- no clinical reminder content if phone is not verified
- handoff gate blocks automatic sends (`SKIPPED_HANDOFF_ACTIVE`)
- confirmation rule: send only if `appointment_starts_at - now >= 3h`

Exit criteria:

- deterministic state transitions for all statuses
- no direct Prisma access from controllers/webhook handlers

### WS3 - Queueing and schedulers (BullMQ)

Deliverables:

- delayed-job scheduling during synchronize/upsert
- dispatcher worker for due jobs
- recovery sweep scheduler every 5 minutes

Implementation notes:

- one delayed job per dispatch id (job id deterministic)
- scheduler updates delayed job when `scheduled_for` changes
- recovery sweep finds missed due dispatches and re-enqueues safely
- batch size configurable (start low, e.g. 50)

Why this model:

- avoids full-table polling every minute
- scales with real work volume
- keeps resilience through periodic reconciliation

Exit criteria:

- reminders execute within SLA window (<= 5 minutes)
- missed jobs after restart are recovered by sweep

### WS4 - Locking, lease renewal, and anti-duplication

Deliverables:

- lease acquisition with `LOCKED` transition
- heartbeat renewal every 60s while processing
- CAS transitions using `id + status + lock_version`
- stale lock recovery only after lease expiry

Required sequence:

1. acquire lock and increment `lock_version`
2. process validations and send attempt
3. before external send, verify current lock ownership
4. transition to terminal status via CAS

Exit criteria:

- no duplicate send under concurrent workers
- stale lock recovery is auditable and safe

### WS5 - Inbound webhook idempotency and button correlation

Deliverables:

- signed `button_payload_id` carrying dispatch identity
- payload signature validation + expiration check
- sender phone match validation against dispatch recipient
- transactional dedup insert + business mutation

Button flows:

- `Confirmar`: set `usuarios.telefono_verificado_en`, then send reminder if >=3h
- `No lo reconozco`: clear `usuarios.Tel_fono`, keep verification null, create suppression

Exit criteria:

- webhook replay does not repeat side effects
- tampered/expired payload is rejected and audited

### WS6 - Verification timeout lifecycle

Deliverables:

- expiration transition: `PHONE_VERIFICATION_PENDING -> PHONE_VERIFICATION_EXPIRED`
- expiration checked by recovery sweep and/or dedicated job

Rules:

- `verification_expires_at = appointment_starts_at - 3h`
- Meta `message_validity_period = 12 hours` does not extend backend business validity
- after expiry, no automatic clinical reminder send

Exit criteria:

- pending verification dispatches cannot remain open indefinitely

### WS7 - Audit, observability, and security

Deliverables:

- audit events for every meaningful transition
- masked phone logs
- correlation ids across scheduler, worker, webhook, and WhatsApp send
- dashboards/alerts for fail rates and queue lag

Minimum metrics:

- dispatches created/updated/sent/failed/skipped
- duplicate inbound ignored count
- lock recovered count
- queue lag (p95)
- send latency vs `scheduled_for`

Security controls:

- no full document numbers in logs
- no full phone in logs/audit metadata
- signed token for button payload
- strict DTO/payload validation for inbound events

Exit criteria:

- operational dashboard supports triage without DB manual work

### WS8 - Test strategy and gates

Unit tests:

- schedule math and timezone handling
- phone normalization
- state transition matrix
- >=3h confirmation rule
- lock CAS and lease renewal behavior

Integration tests:

- migration + repository behavior
- dedup unique index behavior under race
- stale lock recovery behavior
- `usuarios.Tel_fono` update/clear flows

E2E tests:

- verified phone reminder flow
- unverified phone verification flow
- confirm with >=3h send
- confirm with <3h skip
- reject unknown person suppression flow
- replay inbound event has no duplicate effects
- restart/recovery does not lose due dispatches
- multi-worker concurrency does not duplicate sends

Exit criteria:

- all critical tests pass before production enablement

## Rollout plan

### Stage 0 - Dark launch

- write dispatch rows and queue jobs
- do not send to Meta (mock adapter)
- validate metrics and status transitions

### Stage 1 - Internal controlled send

- enable sends for a limited cohort
- monitor failures, lag, and duplicate protections

### Stage 2 - Partial production

- enable by percentage or by site/service
- watch cost and delivery metrics

### Stage 3 - Full production

- full enablement after stable error and duplication rates

Rollback plan:

- disable send feature flag
- keep synchronizer and audit on
- preserve data for replay after fix

## Suggested execution order (task backlog)

1. Migrations + Prisma generate
2. Repository ports + Prisma adapters
3. Synchronizer use case
4. Delayed job scheduling
5. Dispatcher worker core
6. Lock lease + CAS hardening
7. Webhook dedup + signed payload validation
8. Confirm/Reject use cases
9. Verification expiry lifecycle
10. Audit + metrics + alerts
11. Full test suite and rollout

## Definition of done for implementation

A release is done only if:

- all acceptance criteria from the design spec are met
- no duplicate sends under worker concurrency tests
- webhook replay is idempotent in integration and E2E tests
- handoff gating blocks automatic reminders
- verification expiry is enforced
- observability and audit events are complete

## Operational defaults (recommended)

- timezone: `America/Bogota`
- lock TTL: 5 minutes
- lock heartbeat: 60 seconds
- recovery sweep interval: 5 minutes
- dispatcher batch size: 50 (tune by metrics)
- retry policy: immediate, +5m, +15m, then `FAILED`

## Notes for implementation safety

- keep business rules in application/domain layers
- keep WhatsApp payload parsing in adapter layer only
- avoid raw SQL except where Prisma is unclear; isolate raw SQL in infra repositories
- never log or audit full sensitive values
