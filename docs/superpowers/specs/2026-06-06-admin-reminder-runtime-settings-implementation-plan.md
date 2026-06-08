# Implementation Plan: admin reminder runtime settings

## Context

This plan operationalizes a new administrative capability for appointment reminders already implemented in:

- `docs/superpowers/specs/2026-05-25-appointment-reminders-design.md`
- `docs/superpowers/specs/2026-05-25-appointment-reminders-implementation-plan.md`
- `docs/superpowers/specs/2026-05-26-admin-observability-panel-design.md`
- `docs/superpowers/specs/2026-05-26-admin-observability-panel-implementation-plan.md`

The goal is to allow authorized admin users to activate, pause, and tune reminder runtime settings from the existing admin panel without redeploying the backend, and without restart for hot-reloadable settings.

This is an operational settings capability, not a reminder business-rules redesign.

## Objective

Deliver a production-safe runtime settings module for appointment reminders with:

1. the same admin login and RBAC model already used by the panel
2. persisted configuration in bot DB
3. strict allowed values rendered as frontend selects
4. clear separation between operational controls and protected platform controls
5. auditable changes with actor, timestamp, previous value, new value, and reason when required
6. a runtime resolution layer that applies hot-reloadable DB settings without process restart and persists restart-scoped settings safely
7. an emergency pause override that can stop live sends safely

## Non-goals

This phase does not include:

1. editing reminder content, template body text, or clinical payload shape
2. editing appointment business rules such as `24h` scheduling semantics
3. multi-module global configuration UI for unrelated bot modules
4. direct editing of raw environment variables from the browser
5. free-form numeric inputs for reminder runtime settings
6. a CMS-style documentation editor for this phase

## Closed decisions

1. The capability will live inside the existing admin panel and reuse the current admin authentication/session model.
2. The backend source of truth for runtime settings will be bot DB, not process environment variables.
3. Environment variables remain bootstrap defaults and safe fallback values.
4. The reminders domain remains owner of runtime configuration resolution.
5. The admin panel is only a controlled operator interface over reminder runtime settings.
6. All user-editable settings in this phase must be rendered through selects or explicit toggles with allowed values.
7. Emergency pause must be an explicit operational override, not an implicit combination of multiple fields.
8. Reminder settings will be grouped into `primary`, `advanced`, and `protected` sections.
9. `ADMIN` can update all sections.
10. `SUPERVISOR` can view all sections but can update only `primary`.
11. Every mutation must create immutable audit entries.
12. Only hot-reloadable settings must apply without app restart; restart-scoped settings must persist safely and be presented as restart-required stored configuration.
13. The UI must expose both stored values and effective runtime state so operators can see if emergency pause is overriding send mode.
14. The settings view must be implemented as `mobile-first responsive`, with desktop enhancements for prolonged operational use.
15. The module must include a built-in usage guide view for operators and supervisors.

## Recommended UX shape

Use the existing `Recordatorios` area in the panel and split it into three routes:

1. `/admin/reminders`
   - metrics
   - dispatches
   - health and operational visibility

2. `/admin/reminders/settings`
   - runtime settings
   - activation controls
   - emergency pause
   - advanced tuning
3. `/admin/reminders/settings/guide`
   - usage guide
   - operational manual
   - field explanations
   - safe operating procedures

This keeps one admin login, one navigation area, and one reminders module while avoiding a giant mixed screen.

UX strategy:

1. mobile-first for layout, spacing, control sizing, and prioritization
2. responsive across mobile, tablet, and desktop
3. desktop-enhanced for dense operational review and faster side-by-side scanning

## Runtime settings taxonomy

### Primary settings

These are day-to-day operational controls and should be visible first.

1. `sendMode`
2. `sendRolloutPercent`
3. `emergencyPauseEnabled`

### Advanced settings

These affect throughput and scheduling behavior and should be grouped in a collapsible admin-only advanced section.

1. `dispatchBatchSize`
2. `eligibilityLimit`

### Protected settings

These affect engine lifecycle, restart behavior, lease safety, resilience, or business guardrails. They should be editable only by `ADMIN`.

1. `syncEnabled`
2. `dispatchEnabled`
3. `queueEnabled`
4. `syncIntervalMs`
5. `recoverySweepIntervalMs`
6. `workerConcurrency`
7. `lockTtlSeconds`
8. `lockHeartbeatIntervalMs`
9. `minConfirmationHours`

### Fixed bootstrap properties

These are runtime context values but are not operator-editable in this phase.

1. `timezone`

## Runtime mutability classes

Reminder runtime settings are not all equal. The plan must distinguish fields that can be applied immediately from fields that are only safely applied after runtime reload.

### Hot-reloadable settings

These settings must apply without restart because they are consumed at execution time through the runtime resolver.

1. `sendMode`
2. `sendRolloutPercent`
3. `emergencyPauseEnabled`
4. `dispatchBatchSize`
5. `eligibilityLimit`
6. `lockTtlSeconds`
7. `lockHeartbeatIntervalMs`
8. `minConfirmationHours`

### Restart-scoped settings

These settings are currently bound to scheduler timers, worker bootstrapping, or process lifecycle and must not be presented as immediate-effect controls.

1. `syncEnabled`
2. `dispatchEnabled`
3. `queueEnabled`
4. `syncIntervalMs`
5. `recoverySweepIntervalMs`
6. `workerConcurrency`

### Mutability rules

1. hot-reloadable settings apply on the next relevant use case execution without process restart
2. restart-scoped settings persist immediately in DB but do not become effective until controlled runtime reload or process restart
3. the UI must show whether each field is `Aplica de inmediato` or `Requiere reinicio controlado`
4. the UI must not represent restart-scoped fields as globally effective runtime values in phase 1
5. the guide must explain this distinction explicitly

## Allowed values catalog

No free-form values should be accepted from the frontend for this phase.

### Primary

`sendMode`

- `mock`
- `live`

`sendRolloutPercent`

- `0`
- `5`
- `10`
- `25`
- `50`
- `75`
- `100`

`emergencyPauseEnabled`

- `enabled`
- `disabled`

### Advanced

`dispatchBatchSize`

- `10`
- `25`
- `50`
- `100`

`eligibilityLimit`

- `100`
- `250`
- `500`
- `1000`

### Protected

`syncEnabled`

- `enabled`
- `disabled`

`dispatchEnabled`

- `enabled`
- `disabled`

`queueEnabled`

- `enabled`
- `disabled`

`syncIntervalMs`

- `60000`
- `300000`
- `600000`
- `900000`

`recoverySweepIntervalMs`

- `60000`
- `300000`
- `600000`
- `900000`

`workerConcurrency`

- `1`
- `2`
- `3`
- `5`

`lockTtlSeconds`

- `120`
- `180`
- `300`
- `600`

`lockHeartbeatIntervalMs`

- `30000`
- `60000`
- `120000`

`minConfirmationHours`

- `3`
- `4`
- `6`
- `12`

## Effective runtime rules

The UI must show:

1. stored settings
2. authoritative effective values for hot-reloadable settings
3. explicit restart-required messaging for restart-scoped settings

Priority order:

1. emergency pause override
2. persisted DB settings
3. bootstrap environment fallback
4. hardcoded safe fallback in config service

Operational rule:

1. if `emergencyPauseEnabled = true`, no reminder send attempt may reach the external WhatsApp send adapter regardless of stored `sendMode`
2. emergency pause is a hold/freeze override, not a conversion to `mock`
3. emergency pause must not mark dispatches as `sent` or `skipped` solely because pause is active
4. due dispatches blocked by pause must remain eligible for later processing after pause is lifted, subject to normal appointment validity and reminder rules
5. recovery, lock expiry, and audit/reconciliation may continue while pause is active
6. the page must show a visible warning banner when effective live send is paused by override

### Emergency pause semantics

To avoid silent message loss, emergency pause must be implemented as a deferred-send hold.

Required behavior:

1. the dispatcher must not substitute emergency pause with `mock` send mode
2. the system must not generate synthetic `mock sent` outcomes merely because pause is active
3. the reminder dispatch lifecycle must include a dedicated persisted deferred status: `PAUSED_HOLD`
4. when pause is lifted, held dispatches must be re-evaluated and re-enqueued safely
5. if a phone verification confirmation happens while pause is active, business side effects such as phone verification may persist, but the clinical reminder send must remain deferred rather than consumed as sent
6. all pause-related hold and release transitions must be auditable

Canonical implementation rule:

1. when a due reminder reaches the send stage while pause is active, it transitions to `PAUSED_HOLD`
2. `PAUSED_HOLD` dispatches are excluded from normal due-send claiming while pause remains active
3. lifting pause transitions still-eligible `PAUSED_HOLD` dispatches back to `PENDING` and re-enqueues them
4. if a held dispatch is no longer eligible when pause is lifted, it transitions to the corresponding terminal skip or expiry outcome

## Data model

Use a dedicated reminder runtime settings table instead of storing generic key/value pairs without boundaries.

Cross-module dependency:

1. reminder dispatch persistence must add `PAUSED_HOLD` to the dispatch status model
2. no separate pause-hold table is required in phase 1

### Table 1: `bot_appointment_reminder_runtime_settings`

Purpose:

- stores the current active settings snapshot
- one row only for the reminders runtime domain

Recommended fields:

1. `id`
2. `scope_key`
3. `sync_enabled`
4. `dispatch_enabled`
5. `queue_enabled`
6. `send_mode`
7. `send_rollout_percent`
8. `emergency_pause_enabled`
9. `sync_interval_ms`
10. `recovery_sweep_interval_ms`
11. `worker_concurrency`
12. `dispatch_batch_size`
13. `eligibility_limit`
14. `lock_ttl_seconds`
15. `lock_heartbeat_interval_ms`
16. `min_confirmation_hours`
17. `version`
18. `updated_by_admin_user_id`
19. `updated_at`
20. `created_at`

Rules:

1. `scope_key` unique and fixed to `default`
2. `version` increments on every mutation
3. all columns typed explicitly, no JSON blob for primary runtime state
4. fixed bootstrap properties such as timezone are not stored here in phase 1

### Table 2: `bot_appointment_reminder_runtime_setting_events`

Purpose:

- immutable change history for audit and rollback reasoning

Recommended fields:

1. `id`
2. `settings_version`
3. `admin_user_id`
4. `change_type`
5. `section`
6. `reason`
7. `previous_snapshot_json`
8. `new_snapshot_json`
9. `effective_snapshot_json`
10. `occurred_at`

Rules:

1. append-only
2. snapshots stored as JSON for reviewability
3. reason required for protected changes and emergency pause mutations
4. this table is the canonical history source for reminder runtime settings changes

## Backend module ownership

### Domain ownership

Runtime settings belong to `reminders`, not to `admin-reminders`.

Reason:

1. reminders is the business owner of runtime behavior
2. scheduler and sender code should depend on reminder domain ports/services
3. admin module should not become a second business owner

### Recommended backend split

#### `src/modules/reminders`

Add:

1. `domain/appointment-reminder-runtime.types.ts`
2. `domain/ports/appointment-reminder-runtime-settings.repository.ts`
3. `application/services/appointment-reminder-runtime-settings-catalog.service.ts`
4. `application/services/appointment-reminder-runtime-settings-resolver.service.ts`
5. `application/use-cases/get-appointment-reminder-runtime-settings.use-case.ts`
6. `application/use-cases/update-appointment-reminder-runtime-settings.use-case.ts`
7. `application/use-cases/get-appointment-reminder-runtime-options.use-case.ts`
8. `application/use-cases/toggle-appointment-reminder-emergency-pause.use-case.ts`
9. `infrastructure/persistence/mysql/prisma-bot-appointment-reminder-runtime-settings.repository.ts`

#### `src/modules/admin-reminders`

Add:

1. admin-facing controller endpoints for settings
2. query/parser DTO helpers for reminder settings
3. no business logic beyond auth, DTO parsing, and use case invocation

## Shared contracts

Add typed DTO contracts in `packages/shared` for frontend/backend reuse.

Recommended additions:

1. `packages/shared/src/admin/reminder-settings-dto.ts`
2. `packages/shared/src/admin/reminder-settings-schemas.ts`

Recommended exports:

1. `ReminderRuntimeSection`
2. `ReminderSendMode`
3. `ReminderBooleanSelectValue`
4. `ReminderRuntimeSettingsDto`
5. `ReminderRuntimeSettingsOptionsDto`
6. `ReminderRuntimeSettingsUpdateRequestDto`
7. `ReminderEmergencyPauseUpdateRequestDto`

Use Zod or the existing shared-schema pattern so frontend and backend validate the same shapes.

## Backend API design

All endpoints stay under the existing admin API.

### `GET /api/admin/reminders/settings`

Returns:

1. current stored snapshot
2. effective hot-reloadable snapshot
3. metadata
4. section editability for current role
5. runtime application note
6. last updated summary

Response shape:

```ts
interface ReminderRuntimeSettingsDto {
  stored: ReminderRuntimeSettingsSnapshotDto;
  effectiveHotReloadable: ReminderRuntimeHotReloadableSettingsDto;
  metadata: {
    version: number;
    lastUpdatedAtIso: string;
    lastUpdatedByAdminUserId: number | null;
    emergencyPauseReason: string | null;
  };
  runtimeApplication: {
    restartScopedFieldKeys: ReminderRuntimeSettingKey[];
    restartScopedApplyNote: string;
  };
  permissions: {
    canEditPrimary: boolean;
    canEditAdvanced: boolean;
    canEditProtected: boolean;
    canToggleEmergencyPause: boolean;
  };
}
```

### `GET /api/admin/reminders/settings/options`

Returns the allowed select options and field metadata.

Response shape:

```ts
interface ReminderRuntimeSettingsOptionsDto {
  sections: {
    primary: ReminderRuntimeSettingFieldOptionDto[];
    advanced: ReminderRuntimeSettingFieldOptionDto[];
    protected: ReminderRuntimeSettingFieldOptionDto[];
  };
}
```

Each field descriptor should include:

1. field key
2. label
3. description
4. allowed values
5. role restriction
6. warning text if sensitive
7. apply mode: `immediate` or `restart_required`
8. fixed-property marker where applicable

### `PATCH /api/admin/reminders/settings`

Purpose:

- update one or more fields in a single atomic mutation

Rules:

1. request accepts a typed partial object only for editable fields
2. backend validates all fields against the allowed catalog
3. backend rejects protected-field writes from `SUPERVISOR`
4. backend rejects unknown keys
5. optimistic concurrency supported through `expectedVersion`

Request shape:

```ts
interface ReminderRuntimeSettingsUpdateRequestDto {
  expectedVersion: number;
  reason?: string;
  changes: Partial<ReminderRuntimeSettingsSnapshotDto>;
}
```

Behavior:

1. load current snapshot
2. validate RBAC
3. validate field/value catalog
4. validate cross-field invariants
5. persist snapshot update, settings history event, and admin audit event in one bot-DB transaction
6. compute hot-reloadable effective values plus restart-required metadata
7. return updated stored settings and effective hot-reloadable settings

### `POST /api/admin/reminders/settings/emergency-pause`

Purpose:

- explicit, high-visibility operational action

Request shape:

```ts
interface ReminderEmergencyPauseUpdateRequestDto {
  enabled: boolean;
  reason: string;
  expectedVersion: number;
}
```

Rules:

1. reason required
2. action audited separately from general settings update
3. response returns updated stored and effective state

### `GET /api/admin/reminders/settings/history`

Purpose:

- show the last N runtime configuration changes

Query:

1. `page`
2. `pageSize`

Response:

1. actor
2. timestamp
3. change type
4. section
5. reason
6. before summary
7. after summary

This endpoint is recommended for phase 1 of this module because operators need immediate traceability for settings changes.

Source of truth:

1. this endpoint must read from `bot_appointment_reminder_runtime_setting_events`
2. the generic admin audit log is supplementary and not the canonical history view for this module

## Cross-field validation rules

The resolver/use case must validate more than just enum membership.

Required invariants:

1. `lockHeartbeatIntervalMs <= lockTtlSeconds * 1000`
2. `sendRolloutPercent = 0` is valid for live or mock
3. `sendMode = mock` with any rollout is valid
4. `workerConcurrency >= 1`
5. `dispatchBatchSize <= eligibilityLimit`
6. protected changes require non-empty `reason`
7. emergency pause mutations always require non-empty `reason`
8. restart-scoped changes must be represented as restart-required stored configuration, not as immediately effective runtime state

## Runtime resolution layer

The current `AppointmentReminderDispatchConfigService` reads from env. It should evolve into a bootstrap-fallback provider, not remain the final source of truth.

Recommended model:

1. `AppointmentReminderBootstrapConfigService`
   - reads env defaults
   - no DB access

2. `AppointmentReminderRuntimeSettingsResolverService`
   - loads persisted snapshot
   - applies emergency pause override
   - falls back to bootstrap config when no row exists
   - returns typed effective settings object for hot-reloadable fields only

3. reminder schedulers, workers, and delivery services depend on the runtime resolver

This keeps runtime behavior centralized and avoids duplicating priority rules across classes.

### Runtime application model

Phase 1 should not overpromise universal hot-reload where the current runtime lifecycle does not support it.

Rules:

1. hot-reloadable fields are read through the resolver at execution time
2. restart-scoped fields are stored immediately but only applied after controlled runtime reload or process restart
3. the admin UI must present restart-scoped fields as `stored values that require controlled restart`
4. phase 1 does not attempt to compute or verify per-instance applied state for restart-scoped fields
5. automated fleet restart orchestration is not required in this phase

## Frontend architecture

### Route strategy

Use the existing reminders area and add a dedicated settings route.

Recommended routes:

1. `/admin/reminders`
2. `/admin/reminders/settings`
3. `/admin/reminders/settings/guide`

Keep the sidebar item as `Recordatorios` and render an internal sub-navigation inside the reminders area.

Recommended internal sub-navigation:

1. `Operacion`
   - existing reminders metrics and dispatches view
2. `Configuracion`
   - runtime settings view defined in this plan
3. `Guia de uso`
   - embedded operator documentation for reminder runtime settings

### Responsive strategy

The page must be designed mobile-first and progressively enhanced for larger screens.

Rules:

1. mobile is the baseline layout, not a degraded desktop port
2. desktop adds density and layout improvements, but not hidden mandatory actions
3. all critical actions must remain reachable without hover-only interactions
4. no horizontally overflowing operational controls on small screens

### Visual structure

Use a two-column adaptive layout as the default implementation strategy.

Reason:

1. mobile collapses naturally into one readable column
2. desktop gains faster operational scanning
3. runtime state remains visually separate from mutation forms
4. avoids a long, mixed, hard-to-maintain page

Alternative layouts such as a single long form or tab-heavy internal navigation are intentionally not recommended as the primary implementation.

#### Visual zones

The `Configuracion` screen should be composed of these visual zones:

1. page header
2. global runtime status banner
3. primary settings section
4. advanced settings section
5. protected settings section
6. effective state summary
7. emergency pause action card
8. recent settings history

The `Guia de uso` screen should be composed of these visual zones:

1. page header
2. quick-start summary
3. operating modes explanation
4. field-by-field reference
5. emergency pause procedure
6. recommended rollout procedure
7. troubleshooting section
8. audit and traceability notes

#### Header structure

The header should include:

1. page title: `Configuracion operativa de recordatorios`
2. short explanatory subtitle
3. refresh action
4. runtime metadata summary:
   - current version
   - last updated at
   - last updated by

#### Global status banner

The banner must sit above the main layout and communicate the current effective mode.

If emergency pause is active:

1. use warning styling
2. state clearly that real sends are paused by override
3. show reason if available
4. show actor and timestamp if available

If emergency pause is inactive:

1. use neutral or success styling
2. state that runtime behavior follows stored settings

#### Main layout

Mobile-first behavior:

1. a single-column stacked layout is the baseline
2. blocks appear in strict priority order from operationally most important to least important

Desktop-enhanced behavior:

1. use two columns when enough width is available
2. left column should contain editable settings sections
3. right column should contain effective state summary, emergency pause card, and recent history

Recommended desktop split:

1. primary column: approximately `2fr`
2. secondary column: approximately `1fr`

#### Left column content

The left column should render three independent cards:

1. `Controles primarios`
2. `Configuracion avanzada`
3. `Configuracion protegida`

Each card should:

1. have its own title and explanatory copy
2. manage its own save flow
3. avoid a giant page-wide submit action
4. use selects only for editable values

#### Right column content

The right column should render three operational cards:

1. `Estado efectivo`
2. `Pausa de emergencia`
3. `Historial reciente`

This column is intentionally designed as the operator context rail.

#### Effective state card

This card is read-only and should summarize the currently effective runtime behavior.

Suggested fields:

1. effective send mode
2. effective rollout percent
3. emergency pause state
4. global status label such as `Operando`, `Pausado`, or `Modo seguro`
5. restart-required summary for protected lifecycle settings

This card should visually distinguish stored configuration from effective override-driven behavior when they differ.
It should also distinguish immediate-effect fields from restart-required stored fields.

#### Emergency pause card

This card must be highly visible and should not be buried under advanced settings.

Suggested contents:

1. current pause state
2. concise explanation of what pause does
3. explicit action button:
   - `Activar pausa`
   - `Levantar pausa`
4. required reason interaction

Rules:

1. activating or deactivating pause must require confirmation
2. the reason must be captured before mutation
3. the card should remain close to the effective state summary on all breakpoints

#### Primary settings card

This card should contain only day-to-day activation controls:

1. send mode
2. rollout percent
3. emergency pause state

Interaction rules:

1. one save action for the card
2. brief helper text per field
3. no unrelated advanced or protected fields mixed here

#### Advanced settings card

This card should contain operational tuning controls:

1. dispatch batch size
2. eligibility limit

Interaction rules:

1. collapsed by default on mobile
2. expanded by default on desktop only if usability testing supports it
3. helper copy must explain that these values affect throughput and cadence

#### Protected settings card

This card should contain the highest-risk reminder runtime parameters:

1. sync enabled
2. dispatch enabled
3. queue enabled
4. sync interval
5. recovery sweep interval
6. worker concurrency
7. lock ttl
8. lock heartbeat
9. minimum confirmation hours

Interaction rules:

1. stronger warning styling than advanced settings
2. read-only for unauthorized roles
3. reason required for authorized mutations
4. confirmation step required before save

#### Recent history card

This card should provide recent configuration changes without overwhelming the operator.

Mobile behavior:

1. stacked event cards
2. concise before/after summary

Desktop behavior:

1. compact table or list rows
2. actor, section, change type, timestamp, and reason visible at a glance

The history card should prioritize scanability over raw detail density.

### Frontend file split

#### Existing feature

Keep current operational visibility in:

1. `apps/web/src/pages/reminders-page.tsx`
2. `apps/web/src/features/reminders/*`

#### New feature

Add a dedicated feature folder:

1. `apps/web/src/pages/reminder-settings-page.tsx`
2. `apps/web/src/features/reminder-settings/reminder-settings.types.ts`
3. `apps/web/src/features/reminder-settings/reminder-settings.api.ts`
4. `apps/web/src/features/reminder-settings/reminder-settings.hooks.ts`
5. `apps/web/src/features/reminder-settings/ui/reminder-settings-summary-card.tsx`
6. `apps/web/src/features/reminder-settings/ui/reminder-settings-section.tsx`
7. `apps/web/src/features/reminder-settings/ui/reminder-setting-select-field.tsx`
8. `apps/web/src/features/reminder-settings/ui/emergency-pause-banner.tsx`
9. `apps/web/src/features/reminder-settings/ui/reminder-settings-history-table.tsx`
10. `apps/web/src/pages/reminder-settings-guide-page.tsx`
11. `apps/web/src/features/reminder-settings-guide/reminder-settings-guide.types.ts`
12. `apps/web/src/features/reminder-settings-guide/reminder-settings-guide.content.ts`
13. `apps/web/src/features/reminder-settings-guide/ui/reminder-settings-guide-section.tsx`
14. `apps/web/src/features/reminder-settings-guide/ui/reminder-settings-guide-nav.tsx`

This avoids inflating the current reminders page into a large mixed component.

### Guide view architecture

The guide/manual should be implemented as a dedicated read-only view, not as tooltip-only help and not as scattered inline copy.

Recommended approach:

1. author the guide content in typed frontend content modules or versioned Markdown loaded by the app
2. render it through dedicated presentational components
3. keep the content versioned in git alongside the module implementation
4. avoid storing this guide in DB for phase 1

Recommended choice for this project:

1. versioned, typed frontend content module

Reason:

1. strongest reviewability in PRs
2. zero runtime editorial dependency
3. simpler typing and rendering control
4. consistent with an admin panel where operational guidance changes infrequently

### Page composition

The screen should have 6 blocks:

1. effective runtime summary
2. emergency pause banner and action card
3. primary settings section
4. advanced settings section
5. protected settings section
6. recent change history

Layout behavior:

1. on mobile, blocks stack vertically in a single column
2. on tablet, summary and emergency sections may share a row if space allows
3. on desktop, summary and history can use a secondary column while settings remain in the primary column
4. advanced and protected sections should remain collapsible at all breakpoints

### UI behavior

1. every field uses a select
2. values are loaded from backend options endpoint
3. fields disabled by role are visible but read-only
4. protected settings show warning copy
5. page shows `stored` vs `effective` differences when emergency pause is active
6. save action uses optimistic versioning and handles conflict refresh cleanly
7. emergency pause action uses a confirmation dialog with required reason
8. restart-scoped fields must show explicit `Requiere reinicio controlado` messaging
9. restart-scoped fields must not be rendered as already-effective runtime state

Responsive UI rules:

1. primary settings must appear before advanced and protected sections on every breakpoint
2. selects and toggles must have touch-friendly sizing on mobile
3. emergency pause must remain above the fold on common mobile heights when active
4. history table should degrade to stacked rows or summary cards on smaller screens
5. labels, warnings, and descriptions must wrap cleanly without truncating critical meaning
6. actions should group into clear vertical flows on mobile and compact horizontal actions on desktop
7. save actions should remain scoped per section to keep cognitive load low and reduce accidental cross-section edits

### Guide page composition

The guide page should have these sections in order:

1. `Que controla esta pantalla`
2. `Estados operativos y modos de envio`
3. `Como activar reminders de forma segura`
4. `Como usar pausa de emergencia`
5. `Referencia de campos`
6. `Buenas practicas operativas`
7. `Errores comunes y que hacer`
8. `Como auditar cambios`

Guide UI rules:

1. content must be explicit and instructional, not marketing-style
2. every section should use short paragraphs plus structured bullets or tables where needed
3. field explanations should map exactly to the labels shown in the settings view
4. dangerous actions must include warnings and expected effects
5. the guide must be understandable by a non-developer supervisor
6. the guide should support anchor navigation for fast scanning

## Permissions model

### `ADMIN`

Can:

1. view metrics
2. view dispatches
3. edit primary settings
4. edit advanced settings
5. edit protected settings
6. toggle emergency pause
7. view full settings history
8. view guide content

### `SUPERVISOR`

Can:

1. view metrics
2. view dispatches
3. view settings
4. edit primary settings
5. toggle emergency pause only if explicitly approved by product/operations policy
6. view guide content

Recommended default:

1. allow `SUPERVISOR` to edit primary settings
2. allow `SUPERVISOR` to toggle emergency pause
3. deny advanced and protected edits

If policy is stricter, emergency pause can be `ADMIN` only. The backend design should support either rule through one guard decision point.

## Audit requirements

Every mutation must record:

1. admin user id
2. role
3. action name
4. section
5. changed fields
6. previous snapshot
7. new snapshot
8. effective hot-reloadable snapshot
9. reason
10. IP hash if available from admin session context
11. timestamp

Recommended audit actions:

1. `admin.reminders.settings.updated`
2. `admin.reminders.settings.emergency_pause_enabled`
3. `admin.reminders.settings.emergency_pause_disabled`
4. `admin.reminders.settings.update_rejected`
5. `admin.reminders.settings.pause_hold_created`
6. `admin.reminders.settings.pause_hold_released`

Guide reads do not require specific business audit entries in this phase unless admin page access is already audited globally.

Mutation boundary:

1. snapshot update, canonical settings event, and admin audit event must succeed or fail together
2. partial success across those three records is not acceptable
3. if a later cross-system notification is needed, it must be downstream of the committed DB transaction

## Guide content scope

The guide/manual must explain at least:

1. what reminder runtime settings are
2. the difference between `Operacion`, `Configuracion`, and `Guia de uso`
3. what `mock` means
4. what `live` means
5. what rollout percent means
6. what emergency pause does and does not do
7. the difference between `Aplica de inmediato` and `Requiere reinicio controlado`
8. why `sync`, `dispatch`, and `queue` lifecycle controls are admin-only
9. what changes are safe for supervisors
10. what changes are admin-only and why
11. how to activate reminders progressively in production
12. how to rollback safely
13. where to verify that reminders are sending correctly
14. how settings changes are audited

## Guide writing rules

To keep the manual maintainable and useful:

1. write in plain operational Spanish
2. avoid backend-only jargon unless immediately explained
3. use the exact UI labels used in the module
4. avoid duplicated explanations across multiple components
5. keep the guide content centralized in one content source
6. update the guide whenever a setting, label, or operational flow changes

## Testing strategy

### Backend unit tests

1. settings catalog service
2. runtime resolver priority order
3. cross-field invariant validation
4. RBAC for primary vs advanced vs protected edits
5. emergency pause behavior
6. optimistic concurrency mismatch behavior
7. restart-required field disclosure behavior
8. `PAUSED_HOLD` transition policy

### Backend integration tests

1. repository load/create/update snapshot
2. version increment behavior
3. history event persistence
4. audit event creation
5. fallback to bootstrap env defaults when no DB row exists
6. snapshot + settings event + admin audit commit atomically
7. `PAUSED_HOLD` rows are released safely after pause lift

### Frontend tests

1. page renders sections from options endpoint
2. read-only fields for restricted roles
3. select value binding and save mutation
4. emergency pause dialog requires reason
5. stale version conflict refresh flow
6. effective vs stored banner rendering
7. guide page renders all mandatory sections
8. guide anchors navigate to the expected sections

### E2E admin flow tests

1. `ADMIN` updates primary settings successfully
2. `SUPERVISOR` cannot update protected settings
3. emergency pause blocks effective live send state without consuming reminders as sent
4. restart-scoped change is shown as restart-required stored configuration, not as immediately effective runtime state
5. page reflects persisted change after reload
6. guide page is reachable from reminders settings navigation

## Rollout strategy

### Stage 0

Backend only:

1. schema
2. repository
3. resolver
4. use cases
5. audit

No frontend yet.

### Stage 1

Read-only frontend:

1. settings summary
2. options endpoint
3. effective vs stored visibility
4. history visibility
5. guide page

No mutation UI yet.

### Stage 2

Primary settings mutations:

1. `sendMode`
2. `sendRolloutPercent`
3. emergency pause
4. hot vs restart-scoped apply messaging

### Stage 3

Advanced and protected settings with stricter RBAC, restart-required disclosure, and required audit reason.

## Workstreams

### WS1 - Shared contracts and domain modeling

Deliverables:

1. shared DTOs and schemas
2. reminder runtime domain types
3. allowed-values catalog service

Exit criteria:

1. backend and frontend compile against the same contracts
2. no raw stringly-typed field handling

### WS2 - Prisma schema and persistence

Deliverables:

1. runtime settings snapshot table
2. runtime settings event/history table
3. Prisma repository implementation

Exit criteria:

1. migrations validate cleanly
2. repository tests cover snapshot and history persistence

### WS3 - Runtime resolver and use cases

Deliverables:

1. bootstrap config adapter
2. runtime resolver
3. get/update/toggle/history use cases
4. restart-required disclosure model

Exit criteria:

1. reminder services can consume hot-reloadable effective settings without restart
2. restart-scoped settings no longer overpromise immediate effect
3. optimistic concurrency and invariants are enforced

### WS4 - Admin API

Deliverables:

1. settings controller endpoints
2. DTO parsing and validation
3. RBAC enforcement

Exit criteria:

1. endpoints reject invalid values
2. endpoints respect role boundaries

### WS5 - Frontend read model

Deliverables:

1. settings page route
2. summary cards
3. section rendering from options endpoint
4. history table
5. guide page and guide navigation

Exit criteria:

1. read-only screen is usable without mutation support
2. guide content explains safe operation clearly

### WS6 - Frontend mutation flows

Deliverables:

1. primary settings update form
2. emergency pause dialog
3. advanced/protected save flows
4. conflict and success states

Exit criteria:

1. operators can update allowed settings without ambiguity
2. protected changes require stronger interaction and reason

### WS7 - Reminder integration hardening

Deliverables:

1. schedulers and senders switched to runtime resolver
2. no remaining direct env ownership in reminder runtime decisions
3. emergency pause implemented as deferred hold semantics, not mock send substitution
4. scheduler boot-time controls remain restart-scoped by design and are not represented as hot-reloadable controls in the UI

Exit criteria:

1. hot-reloadable live behavior changes when DB settings change
2. restart-scoped settings are persisted safely and surfaced as restart-required stored configuration
3. emergency pause does not consume reminders as sent

## Definition of done

This capability is done only when:

1. reminder runtime settings can be read and updated from the admin panel
2. allowed values are controlled by backend catalogs and rendered as selects
3. emergency pause is explicit, visible, and audited
4. hot-reloadable reminder runtime services consume effective DB-backed settings without restart
5. RBAC is enforced for primary, advanced, and protected settings
6. settings changes are traceable through history and audit
7. frontend and backend share typed contracts
8. the reminders metrics/dispatches screen remains separate from settings to avoid UI sprawl
9. the module includes a clear built-in usage guide for operators and supervisors
10. restart-scoped settings are clearly identified and never misrepresented as immediate-effect changes
