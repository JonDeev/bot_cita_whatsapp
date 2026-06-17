# Implementation Plan: admin survey runtime settings

## Context

This plan operationalizes a new administrative capability for satisfaction surveys already implemented in:

- `docs/superpowers/specs/2026-05-07-satisfaction-surveys-design.md`
- `docs/superpowers/specs/2026-06-17-admin-survey-runtime-settings-design.md`

The goal is to add a production-safe `Configuracion` section under `Encuestas` so authorized operators can control survey sends without redeploying the backend and without touching `reminders`.

Hard scope limits:

1. do not modify `src/modules/reminders/**`
2. do not modify `src/modules/admin-reminders/**`
3. do not change patient-facing survey copy, states, or Flow UX
4. do not execute tests in this task

## Delivery strategy

Use a bounded, low-risk rollout:

1. shared contracts first
2. Prisma schema and migration before backend logic
3. surveys domain as the single owner of runtime settings
4. admin API adapter after the domain is stable
5. frontend only after contracts and endpoints are closed
6. add tests last, but do not execute them in this task

Anti-spaghetti rules:

1. no generic cross-module settings engine
2. no direct Prisma access from controllers
3. no large god-services
4. no free-form operational numeric inputs
5. no duplicated runtime decision logic across scheduler, dispatcher, and sender

## Workstreams

### WS1 - Shared contracts

Objective:

Create canonical DTOs and schemas before backend or frontend implementation.

Files to create:

1. `packages/shared/src/admin/survey-settings-dto.ts`
2. `packages/shared/src/admin/survey-settings-schemas.ts`

Files to edit:

1. `packages/shared/src/index.ts`

Required content:

1. `SURVEY_RUNTIME_SECTIONS`
2. `SURVEY_RUNTIME_SETTING_KEYS`
3. `SURVEY_RUNTIME_APPLY_MODES`
4. `SURVEY_SEND_MODES`
5. `SURVEY_BOOLEAN_SELECT_VALUES`
6. `SurveyRuntimeSettingsSnapshotDto`
7. `SurveyRuntimeSettingsOptionsDto`
8. `SurveyRuntimeSettingsDto`
9. `SurveyRuntimeSettingsUpdateRequestDto`
10. `SurveyEmergencyPauseUpdateRequestDto`
11. history DTOs

Required rules:

1. DTO naming must stay survey-specific
2. Zod schemas must be strict
3. all values must come from fixed enums
4. shared package must remain framework-agnostic

Exit criteria:

1. backend and frontend can both import survey settings contracts
2. no dependency on `reminder-settings-*`
3. no circular imports

### WS2 - Prisma models and migration

Objective:

Persist runtime settings and immutable change history in the bot database.

Files to edit:

1. `prisma/bot/schema.prisma`

Files to create:

1. `prisma/bot/migrations/20260617xxxxxx_add_satisfaction_survey_runtime_settings/migration.sql`

Required models:

1. `BotSatisfactionSurveyRuntimeSettings`
2. `BotSatisfactionSurveyRuntimeSettingEvent`

Required fields for settings:

1. `scopeKey`
2. `sendMode`
3. `sendRolloutPercent`
4. `emergencyPauseEnabled`
5. `dispatchEnabled`
6. `eligibilityLimit`
7. `expirationHours`
8. `scheduleProfile`
9. `schedulerLoopEnabled`
10. `tickIntervalMs`
11. `slotLockTtlSeconds`
12. `maxDispatchesPerRun`
13. `version`
14. `updatedByAdminUserId`
15. `updatedAt`
16. `createdAt`

Required fields for events:

1. `settingsVersion`
2. `adminUserId`
3. `changeType`
4. `section`
5. `reason`
6. `previousSnapshotJson`
7. `newSnapshotJson`
8. `effectiveSnapshotJson`
9. `occurredAt`
10. `createdAt`

Required indexes and constraints:

1. unique on `scope_key`
2. index on `updated_at`
3. index on `updated_by_admin_user_id`
4. index on `settings_version`
5. index on `admin_user_id, occurred_at`
6. index on `section, occurred_at`

Exit criteria:

1. Prisma schema expresses the two new models cleanly
2. migration is readable and limited to surveys runtime settings
3. no unrelated schema changes

### WS3 - Surveys domain contracts

Objective:

Define the survey runtime settings bounded context in the domain layer.

Files to create:

1. `src/modules/surveys/domain/satisfaction-survey-runtime.types.ts`
2. `src/modules/surveys/domain/ports/satisfaction-survey-runtime-settings.repository.ts`

Files to edit:

1. `src/modules/surveys/domain/surveys.tokens.ts`

Required content:

1. domain snapshot type
2. hot-reloadable settings type
3. restart-scoped settings type
4. field definitions
5. change type constants
6. settings record type
7. event record type
8. repository port
9. `SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY` token

Rules:

1. keep domain independent from Prisma and NestJS
2. keep naming explicit and survey-specific
3. do not leak admin controller concerns into domain types

Exit criteria:

1. domain fully describes the runtime settings model
2. repository port is enough for use cases and resolver
3. no dependency on `admin-surveys`

### WS4 - Repository and runtime services

Objective:

Implement persistence and runtime resolution inside the surveys module.

Files to create:

1. `src/modules/surveys/infrastructure/persistence/mysql/prisma-bot-satisfaction-survey-runtime-settings.repository.ts`
2. `src/modules/surveys/application/services/satisfaction-survey-runtime-settings-catalog.service.ts`
3. `src/modules/surveys/application/services/satisfaction-survey-runtime-settings-resolver.service.ts`
4. `src/modules/surveys/application/services/satisfaction-survey-runtime-settings-initializer.service.ts`

Files to edit:

1. `src/modules/surveys/surveys.module.ts`

Repository responsibilities:

1. find settings by scope
2. list recent events
3. find latest emergency pause event when needed
4. save settings and event transactionally
5. enforce optimistic concurrency through `expectedVersion`

Catalog responsibilities:

1. expose field metadata
2. expose allowed values
3. define editable roles per field
4. define `applyMode`
5. define `requiresReason`

Resolver responsibilities:

1. merge stored settings with bootstrap defaults
2. compute effective hot-reloadable view
3. centralize operational overrides
4. expose restart-scoped notes

Initializer responsibilities:

1. seed defaults if settings do not exist
2. use environment only as bootstrap
3. write immutable bootstrap event

Exit criteria:

1. a single resolver becomes the canonical source of runtime truth
2. scheduler, dispatcher, and sender can depend on the resolver instead of duplicating logic
3. surveys module wires the new services without touching reminders

### WS5 - Surveys application use cases

Objective:

Expose a clean application API owned by the surveys module.

Files to create:

1. `src/modules/surveys/application/use-cases/get-satisfaction-survey-runtime-settings.use-case.ts`
2. `src/modules/surveys/application/use-cases/get-satisfaction-survey-runtime-options.use-case.ts`
3. `src/modules/surveys/application/use-cases/update-satisfaction-survey-runtime-settings.use-case.ts`
4. `src/modules/surveys/application/use-cases/toggle-satisfaction-survey-emergency-pause.use-case.ts`
5. `src/modules/surveys/application/use-cases/list-satisfaction-survey-runtime-setting-events.use-case.ts`

Required behavior:

1. settings reads must audit admin access
2. update must validate changed fields against catalog
3. update must derive affected section deterministically
4. update must require `reason` for sensitive fields
5. emergency pause must be explicit and isolated
6. optimistic concurrency conflicts must fail clearly

Exit criteria:

1. all mutation rules live in use cases, not controllers
2. audit metadata is complete and consistent
3. no use case depends on frontend concerns

### WS6 - Runtime integration in surveys only

Objective:

Apply the new runtime settings to the survey engine without changing patient UX.

Files to edit:

1. `src/modules/surveys/infrastructure/scheduling/satisfaction-survey-dispatch.scheduler.ts`
2. `src/modules/surveys/infrastructure/scheduling/satisfaction-survey-dispatch-scheduler-config.service.ts`
3. `src/modules/surveys/application/services/satisfaction-survey-dispatch-window.service.ts`
4. `src/modules/surveys/application/use-cases/dispatch-half-hourly-satisfaction-surveys.use-case.ts`
5. `src/modules/surveys/application/use-cases/send-satisfaction-survey-flow-invitation.use-case.ts`

Integration rules:

1. scheduler loop checks `schedulerLoopEnabled`
2. window service resolves against `scheduleProfile`
3. batch dispatcher uses `dispatchEnabled`
4. batch dispatcher applies `eligibilityLimit`
5. batch dispatcher applies `maxDispatchesPerRun`
6. batch dispatcher uses `expirationHours`
7. scheduler lock TTL uses `slotLockTtlSeconds`
8. sender uses `sendMode`
9. sender respects `emergencyPauseEnabled`
10. sender respects `sendRolloutPercent`

Explicit non-changes:

1. do not edit `record-satisfaction-survey-flow-submission.use-case.ts`
2. do not edit `record-satisfaction-survey-template-reply.use-case.ts`
3. do not edit survey copy or question text
4. do not change status semantics visible to patients

Exit criteria:

1. runtime behavior changes are strictly operational
2. patient conversation contract remains unchanged
3. no duplicated settings checks outside the resolver-driven flow

### WS7 - Admin surveys API adapter

Objective:

Expose the new surveys runtime settings through the admin backend.

Files to create:

1. `src/modules/admin-surveys/application/use-cases/get-admin-survey-runtime-settings.use-case.ts`
2. `src/modules/admin-surveys/application/use-cases/get-admin-survey-runtime-options.use-case.ts`
3. `src/modules/admin-surveys/application/use-cases/update-admin-survey-runtime-settings.use-case.ts`
4. `src/modules/admin-surveys/application/use-cases/toggle-admin-survey-emergency-pause.use-case.ts`
5. `src/modules/admin-surveys/application/use-cases/list-admin-survey-runtime-setting-history.use-case.ts`

Files to edit:

1. `src/modules/admin-surveys/application/services/admin-surveys-query-parser.service.ts`
2. `src/modules/admin-surveys/presentation/http/admin-surveys.controller.ts`
3. `src/modules/admin-surveys/admin-surveys.module.ts`

New endpoints:

1. `GET /api/admin/surveys/settings`
2. `GET /api/admin/surveys/settings/options`
3. `GET /api/admin/surveys/settings/history`
4. `PATCH /api/admin/surveys/settings`
5. `POST /api/admin/surveys/settings/emergency-pause`

Rules:

1. reuse current admin auth, guards, and roles model
2. parse all input through Zod-backed parser methods
3. keep business logic delegated to surveys use cases

Exit criteria:

1. admin-surveys remains a thin adapter
2. role and CSRF protections mirror current admin patterns
3. no survey runtime logic leaks into controllers

### WS8 - Frontend surveys settings experience

Objective:

Add a dedicated survey settings UI without reusing reminder-settings code directly.

Files to create:

1. `apps/web/src/features/survey-settings/survey-settings.types.ts`
2. `apps/web/src/features/survey-settings/survey-settings.api.ts`
3. `apps/web/src/features/survey-settings/survey-settings.hooks.ts`
4. `apps/web/src/features/survey-settings/ui/survey-settings-primary-form.tsx`
5. `apps/web/src/features/survey-settings/ui/survey-settings-advanced-form.tsx`
6. `apps/web/src/features/survey-settings/ui/survey-settings-protected-form.tsx`
7. `apps/web/src/features/survey-settings/ui/survey-settings-summary-card.tsx`
8. `apps/web/src/features/survey-settings/ui/survey-settings-history-table.tsx`
9. `apps/web/src/features/survey-settings/ui/survey-settings-emergency-pause-card.tsx`
10. `apps/web/src/features/survey-settings/ui/survey-settings-emergency-pause-dialog.tsx`
11. `apps/web/src/features/survey-settings/ui/survey-settings-emergency-pause-banner.tsx`
12. `apps/web/src/pages/survey-settings-page.tsx`

Files to edit:

1. `apps/web/src/pages/surveys-page.tsx`
2. `apps/web/src/app/router.tsx`

Frontend UX rules:

1. route shape stays under `Encuestas`
2. internal nav exposes `Operacion | Configuracion`
3. forms use selects and explicit toggles only
4. show stored version, last update, actor, and effective status
5. show restart-required note where relevant
6. show permissions clearly

Exit criteria:

1. the settings page is visually consistent with the admin panel
2. survey settings logic stays in `survey-settings/*`
3. no imports from `features/reminder-settings/*`

### WS9 - Documentation and test additions

Objective:

Document the capability and add the required test files without executing them.

Files to create or edit:

1. spec docs under `docs/superpowers/specs/`
2. unit specs for catalog, resolver, initializer, and use cases
3. repository spec for Prisma runtime settings repository
4. controller spec for admin surveys settings routes
5. frontend type/API tests if the repo pattern requires them

Required rule:

1. tests are added but not executed in this task

Exit criteria:

1. expected coverage areas are represented
2. no test command is executed

## Recommended field ownership

`primary`

1. editable by `ADMIN` and `SUPERVISOR`
2. low-friction day-to-day controls

`advanced`

1. editable by `ADMIN` only
2. throughput and dispatch guardrails

`protected`

1. editable by `ADMIN` only
2. lifecycle and scheduler safety controls

## Rollout safeguards

Recommended rollout order:

1. seed defaults with `sendMode=mock`
2. validate panel reads and audit entries
3. validate updates and version conflicts
4. enable limited live rollout through `sendRolloutPercent`
5. keep emergency pause available from day one

Required operational guarantees:

1. `mock` never calls Meta
2. emergency pause always overrides real sends
3. stored and effective values are both visible
4. restart-scoped settings never pretend to apply immediately

## Out of scope reminders

The following areas must remain untouched:

1. `src/modules/reminders/**`
2. `src/modules/admin-reminders/**`
3. reminder shared DTOs and schemas
4. reminder frontend settings feature

## Final acceptance criteria

This initiative is complete when:

1. surveys has its own runtime settings bounded context
2. admin panel exposes `Encuestas > Configuracion`
3. all survey settings are persisted and versioned in bot DB
4. runtime behavior is controlled from surveys settings only
5. audit history is immutable and operator-visible
6. patient-facing survey UX remains unchanged
7. reminders code remains untouched
8. tests are added where needed but not executed in this task
