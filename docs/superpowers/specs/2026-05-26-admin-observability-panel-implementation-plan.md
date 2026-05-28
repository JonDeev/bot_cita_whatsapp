# Implementation Plan: admin observability panel phase 1

## Context

This plan operationalizes the approved design in:

- `docs/superpowers/specs/2026-05-26-admin-observability-panel-design.md`

The goal is to deliver a production-safe administrative observability panel for the official WhatsApp bot without reopening architectural decisions and without destabilizing existing bot flows.

Phase 1 remains intentionally constrained to:

1. secure admin authentication
2. RBAC and session hardening
3. dashboard observability
4. conversations and message traceability
5. reminders and surveys metrics
6. technical and audit logs
7. critical-event SSE updates

Non-goals in this plan:

1. human advisor chat from the panel
2. full user management UI
3. `/admin/agents` or advisor CRUD screens
4. WebSocket live chat
5. advanced settings UI

`admin-users` is treated in phase 1 as backend-only bootstrap/support capability, not as a frontend module.

## Delivery strategy

Use incremental, low-risk delivery:

1. security and persistence foundations first
2. admin API before frontend
3. no frontend buildout until auth, RBAC, CSRF, audit, and tests are stable
4. small verifiable blocks with local validation after each block
5. avoid touching existing bot modules unless required for integration

Recommended merge discipline:

1. one workstream at a time
2. green Prisma validation before moving on
3. green auth/RBAC tests before SSE or frontend
4. no speculative modules

## Workstreams

### WS1 - Shared contracts and admin primitives

Objective:

Create the shared package and canonical admin contracts before backend implementation.

Deliverables:

1. `packages/shared/package.json`
2. `packages/shared/src/index.ts`
3. `packages/shared/src/admin/admin-role.ts`
4. `packages/shared/src/admin/auth-schemas.ts`
5. `packages/shared/src/admin/auth-dto.ts`

Required exports:

1. `AdminRole`
2. `AdminUsernameSchema`
3. `AdminLoginIdentifierSchema`
4. `AdminLoginRequestSchema`
5. `AdminAuthMeResponseDto`
6. permission or capability constants if needed by backend/frontend

Rules:

1. `username` regex: `^[a-z0-9._-]{3,32}$`
2. `username` normalized with `trim + lowercase`
3. `email` normalized with `trim + lowercase`
4. login request uses `identifier + password`
5. no framework-specific code in shared package

Exit criteria:

1. package resolves from root workspace
2. backend can import shared types
3. no circular dependency on app code

### WS2 - Prisma admin models and migration

Objective:

Add the minimal admin persistence model to the bot database.

Deliverables:

1. Prisma enums for admin role and admin user status
2. `bot_admin_users`
3. `bot_admin_sessions`
4. `bot_admin_audit_events`
5. migration SQL

Required fields:

`bot_admin_users`

1. `id`
2. `email`
3. `username`
4. `display_name`
5. `password_hash`
6. `role`
7. `status`
8. `last_login_at`
9. `created_at`
10. `updated_at`

`bot_admin_sessions`

1. `id`
2. `user_id`
3. `session_token_hash`
4. `csrf_token_hash`
5. `ip_hash`
6. `user_agent`
7. `last_seen_at`
8. `expires_at`
9. `revoked_at`
10. `created_at`

`bot_admin_audit_events`

1. `id`
2. `admin_user_id`
3. `action`
4. `resource_type`
5. `resource_id`
6. `metadata`
7. `ip_hash`
8. `occurred_at`
9. `created_at`

Required constraints and indexes:

1. unique on `email`
2. unique on `username`
3. index on `role, status`
4. index on `expires_at, revoked_at` for sessions
5. index on `session_token_hash`
6. index on `action, occurred_at` for audit
7. index on `admin_user_id, occurred_at`

Rules:

1. do not modify existing bot tables beyond what is required for relations
2. keep admin audit separate from conversation audit
3. use exact Prisma model and table names from the real schema

Exit criteria:

1. `pnpm prisma:bot:validate` passes
2. migration is generated and readable
3. `pnpm prisma:bot:generate` passes

### WS3 - Secure bootstrap and admin seed

Objective:

Create a safe bootstrap path for the initial `ADMIN`.

Deliverables:

1. secure seed script or command
2. environment variable contract for initial password
3. initial admin creation logic

Rules:

1. no fixed password versioned in git
2. password comes from environment variable or deployment secret
3. initial `username` suggested: `admin`
4. initial `email` must be explicitly configured
5. initial role: `ADMIN`
6. initial status: `ACTIVE`
7. document mandatory password rotation before production

Optional support:

1. controlled script or command to create a `SUPERVISOR` if needed during phase 1
2. no phase-1 admin user UI

Exit criteria:

1. bootstrap can create first `ADMIN`
2. rerun is idempotent or safely guarded
3. no secret value is committed

### WS4 - Admin auth module and opaque sessions

Objective:

Implement secure admin authentication with server-side sessions.

Deliverables:

1. `src/modules/admin-auth`
2. `POST /api/admin/auth/login`
3. `GET /api/admin/auth/me`
4. `GET /api/admin/auth/csrf`
5. `POST /api/admin/auth/logout`

Required behavior:

1. `identifier` can be `username` or `email`
2. if identifier contains `@`, authenticate by normalized email
3. otherwise authenticate by normalized username
4. session cookie name: `__Host-sism_admin_session`
5. cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`
6. session state stored in DB and cached in Redis
7. logout revokes session and clears cookie

Anti-enumeration behavior:

1. always respond with `Credenciales invalidas` on failure
2. always compute `Argon2id.verify(hashCandidate, password)`
3. use real `password_hash` if user exists
4. use `DUMMY_ARGON2ID_HASH` if user does not exist
5. do not short-circuit inactive users before the verify step

`DUMMY_ARGON2ID_HASH` requirements:

1. must be a valid Argon2id hash
2. must be pre-generated
3. must work with `Argon2id.verify`
4. must not be a plain string
5. should use parameters close to production hashes

Exit criteria:

1. successful login creates session and cookie
2. invalid login remains generic
3. session lookup works through Redis and DB
4. logout revokes session safely

### WS5 - CSRF, guards, and authorization

Objective:

Harden the admin API before building any admin UI.

Deliverables:

1. CSRF token issuance endpoint
2. CSRF validation middleware/guard for mutating routes
3. `AdminSessionGuard`
4. `AdminRolesGuard`
5. role decorators and request context helpers

Rules:

1. CSRF is implemented in phase A, not deferred
2. frontend sends CSRF in `X-CSRF-Token`
3. CSRF token is never sent in query params
4. CSRF token is not stored in local storage or session storage
5. SSE `GET /api/admin/stream` requires session but not CSRF
6. authorization is deny-by-default
7. `SUPERVISOR` cannot view raw technical JSON
8. `ASESOR` exists as a role but receives no phase-1 access

Exit criteria:

1. protected routes reject unauthenticated requests
2. restricted routes reject unauthorized roles
3. CSRF rejects invalid mutating requests

### WS6 - Redis fallback and session lifecycle

Objective:

Define and implement safe session lookup behavior under cache loss.

Deliverables:

1. Redis-backed session store adapter
2. DB fallback for session resolution
3. Redis rehydration on valid DB session lookup
4. session expiration/revocation utilities

Required sequence:

1. read session from Redis by token hash
2. on Redis miss, query MySQL
3. if DB session exists, is not revoked, and is not expired, rehydrate Redis
4. if DB fails or session is invalid, fail closed
5. never trust cookie presence alone

Exit criteria:

1. Redis miss still allows valid session recovery
2. invalid or revoked session never authenticates
3. session expiration is deterministic

### WS7 - Login throttling and audit

Objective:

Add operationally safe protection against brute force and misuse.

Deliverables:

1. throttling by IP
2. throttling by normalized identifier
3. admin audit writer/adapter
4. audit event naming and metadata conventions

Minimum audit events:

1. `admin.auth.login_succeeded`
2. `admin.auth.login_failed`
3. `admin.auth.logout`
4. `admin.auth.csrf_issued`
5. `admin.auth.access_denied`
6. `admin.auth.session_revoked`
7. `admin.conversation.viewed`

Rules:

1. no permanent automatic account lock in phase 1
2. failed login response stays generic
3. audit metadata must not expose passwords, session token raw values, or sensitive patient data
4. mask IP or store hashed IP if that is the agreed policy

Exit criteria:

1. abusive login patterns are rate-limited
2. audit events support incident review
3. no user enumeration through audit-facing behavior

### WS8 - Admin overview and live feed API

Objective:

Expose the minimum observability surface required by the dashboard.

Deliverables:

1. `src/modules/admin-overview`
2. `GET /api/admin/overview`
3. `GET /api/admin/live-feed`

Overview should aggregate from existing data sources:

1. `bot_conversations`
2. `bot_messages`
3. `bot_outbox_messages`
4. `bot_webhook_events`
5. `bot_survey_dispatches`
6. `bot_appointment_reminder_dispatches`

Suggested initial metrics:

1. inbound messages last 24h
2. outbound messages last 24h
3. outbox failures last 24h
4. webhook failures last 24h
5. reminder dispatch status totals
6. survey dispatch status totals
7. active conversations count

Rules:

1. no internal HTTP calls to `/internal/*`
2. reuse existing application services or repositories directly
3. `SUPERVISOR` sees operationally safe summaries only

Exit criteria:

1. dashboard summary endpoint is stable and fast
2. live-feed bootstrap endpoint returns recent critical events

### WS9 - Dashboard stream (SSE)

Objective:

Provide near-real-time operational updates without WebSocket complexity.

Deliverables:

1. `src/modules/dashboard-stream`
2. `GET /api/admin/stream`
3. internal event-to-SSE bridge

Initial SSE event types:

1. `message.inbound`
2. `message.outbound`
3. `outbox.failed`
4. `webhook.failed`
5. `reminder.failed`
6. `survey.completed`
7. `auth.session.revoked`
8. `system.degraded`

Production requirements behind proxy:

1. authenticated stream only
2. no CSRF required for this GET route
3. disable proxy buffering
4. heartbeat frames emitted periodically
5. close connection after session revocation
6. use headers appropriate for `text/event-stream`
7. consider `X-Accel-Buffering: no`
8. consider `Cache-Control: no-cache`
9. consider `Connection: keep-alive`

Exit criteria:

1. stream works with valid session
2. revoked session drops the stream
3. frontend can invalidate queries from SSE events later

### WS10 - Conversations admin API

Objective:

Expose read-only operational access to conversations and messages.

Deliverables:

1. `src/modules/admin-conversations`
2. `GET /api/admin/conversations`
3. `GET /api/admin/conversations/:id`
4. `GET /api/admin/conversations/:id/messages`

Required capabilities:

1. pagination
2. filters by status, partial phone, date range
3. conversation metadata view
4. message timeline pagination
5. role-based masking
6. audit of sensitive views

Rules:

1. no mutating conversation actions in phase 1
2. raw payload visibility restricted to `ADMIN`
3. preserve performance on long message histories

Exit criteria:

1. operational staff can inspect conversations safely
2. supervisors cannot access restricted technical detail

### WS11 - Reminders and surveys admin API

Objective:

Expose existing metrics and dispatch views through `/api/admin/*`.

Deliverables:

1. `src/modules/admin-reminders`
2. `src/modules/admin-surveys`
3. `GET /api/admin/reminders/metrics`
4. `GET /api/admin/reminders/dispatches`
5. `GET /api/admin/surveys/metrics`
6. `GET /api/admin/surveys/dispatches`

Rules:

1. do not proxy to `/internal/*` by HTTP
2. reuse the existing application layer where possible
3. preserve existing security and validation behavior

Exit criteria:

1. dashboard and detail views can use admin-safe reminder and survey endpoints
2. current internal endpoints remain untouched unless refactoring is clearly needed

### WS12 - Admin logs API

Objective:

Provide a focused operational log surface for the panel.

Deliverables:

1. `src/modules/admin-logs`
2. `GET /api/admin/logs/events`
3. `GET /api/admin/logs/failures`
4. `GET /api/admin/logs/audit`

Rules:

1. `SUPERVISOR` gets summarized operational logs
2. `ADMIN` can view expanded technical metadata
3. keep payload masking consistent across modules

Exit criteria:

1. operators can triage without manual DB inspection
2. audit trail remains readable and constrained by role

### WS13 - Frontend shell and authenticated routing

Objective:

Build the frontend only after admin backend foundations are secure.

Deliverables:

1. `apps/web` scaffold
2. Vite + React + TypeScript setup
3. React Router protected routes
4. TanStack Query providers
5. app shell with sidebar and header
6. login screen
7. unauthorized screen

Rules:

1. no frontend buildout before WS1-WS7 are stable
2. all requests use `credentials: 'include'`
3. CSRF token remains in memory only
4. do not implement user management UI in phase 1

Exit criteria:

1. admin user can log in and navigate protected routes
2. session expiration and unauthorized states are handled cleanly

### WS14 - Frontend observability screens

Objective:

Implement the phase-1 admin screens against the secured admin API.

Deliverables:

1. dashboard
2. conversations list
3. conversation detail
4. reminders view
5. surveys view
6. logs view
7. profile view

Rules:

1. use SSE to invalidate or refresh query state
2. show operational toasts with Sonner
3. no `/admin/agents` or user CRUD navigation
4. respect role-based visibility in the UI, but enforce security in backend

Exit criteria:

1. frontend covers all approved phase-1 screens
2. critical events surface without manual reload

## Suggested execution order

Use this exact order unless the repo reveals a strong dependency change:

1. WS1 - Shared contracts and admin primitives
2. WS2 - Prisma admin models and migration
3. WS3 - Secure bootstrap and admin seed
4. WS4 - Admin auth module and opaque sessions
5. WS5 - CSRF, guards, and authorization
6. WS6 - Redis fallback and session lifecycle
7. WS7 - Login throttling and audit
8. WS8 - Admin overview and live feed API
9. WS9 - Dashboard stream (SSE)
10. WS10 - Conversations admin API
11. WS11 - Reminders and surveys admin API
12. WS12 - Admin logs API
13. WS13 - Frontend shell and authenticated routing
14. WS14 - Frontend observability screens

## Phase map

### Phase A - Backend foundations

Includes:

1. WS1
2. WS2
3. WS3
4. WS4
5. WS5
6. WS6
7. WS7

Mandatory validation after phase A:

1. `pnpm prisma:bot:validate`
2. `pnpm prisma:bot:generate`
3. relevant auth/RBAC test command
4. no regression in existing test surface touched by shared infra

### Phase B - Overview and SSE

Includes:

1. WS8
2. WS9

Validation:

1. overview endpoint test coverage
2. authenticated SSE behavior verification
3. proxy/headers checklist documented

### Phase C - Observability APIs

Includes:

1. WS10
2. WS11
3. WS12

Validation:

1. role-based masking tests
2. endpoint contract tests where practical
3. existing internal endpoints still work

### Phase D - Frontend shell

Includes:

1. WS13

Validation:

1. build passes
2. protected routes behave correctly
3. login/logout/session-expired flows verified

### Phase E - Frontend observability UI

Includes:

1. WS14

Validation:

1. dashboard and detail views render against admin API
2. SSE-triggered refresh behavior works
3. role-driven UI visibility matches backend rules

### Phase F - Hardening and pre-release checks

Includes:

1. CSRF review in production-like environment
2. cookie and proxy verification
3. SSE buffering verification
4. E2E smoke coverage
5. audit and masking review

## Test plan

### Unit tests

1. identifier normalization
2. username schema validation
3. anti-enumeration logic with `hashCandidate`
4. CSRF validation
5. role guard behavior
6. session resolution with Redis miss and DB fallback

### Integration tests

1. Prisma repository behavior for admin users/sessions/audit
2. unique constraint behavior for `email` and `username`
3. session revocation path
4. SSE auth gate
5. role-based payload masking

### E2E tests

1. login success
2. login failure generic response
3. logout
4. overview access with valid session
5. denied access for missing session
6. denied access for insufficient role

## Risks and controls

### Risk 1 - Session security regression

Control:

1. implement auth before any admin UI
2. verify cookie flags in tests and manual checks
3. fail closed on Redis/DB uncertainty

### Risk 2 - Scope creep into user management UI

Control:

1. phase-1 user management stays backend-only
2. no `/admin/agents` route
3. no frontend CRUD for admin users

### Risk 3 - Breaking existing bot flows

Control:

1. do not modify bot modules unless required
2. prefer additive admin modules
3. validate internal endpoints after admin reuse

### Risk 4 - Sensitive data leakage

Control:

1. masking by role
2. no raw technical payloads for `SUPERVISOR`
3. audit sensitive views

### Risk 5 - SSE instability behind proxy

Control:

1. heartbeat
2. buffering disabled
3. authenticated stream only
4. close stream on revocation

## Definition of ready to implement

This plan is ready for coding when:

1. phase ordering is accepted
2. phase A scope is accepted
3. `admin-users` is understood as backend-only in phase 1
4. no new architecture changes are requested

## First execution slice

The first coding slice should be:

1. inspect `prisma/bot/schema.prisma`
2. create `packages/shared`
3. add `AdminRole` and auth schemas
4. add Prisma admin models
5. generate migration
6. add secure bootstrap path for initial `ADMIN`

Stop after that slice and validate before continuing into auth handlers.
